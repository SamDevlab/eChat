#!/usr/bin/env bash
set -euo pipefail

STATE_DIR=/var/lib/echat-chatwoot-lab
CHATWOOT_DIR=/home/chatwoot/chatwoot
CHATWOOT_ENV=/home/chatwoot/chatwoot/.env
REDIS_DIR=/var/lib/redis/echat-chatwoot-lab
REDIS_PIDFILE=/run/redis/echat-chatwoot-lab.pid
REDIS_LOG=/var/log/redis/echat-chatwoot-lab.log
PG_VERSION=16
PG_CLUSTER=main
PG_PORT=5433

if [[ "${1:-status}" == start ]]; then
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
fi

online_pg() { pg_isready -h 127.0.0.1 -p "$PG_PORT" -q; }
online_redis() { [[ "$(redis-cli -h 127.0.0.1 -p 6380 ping 2>/dev/null || true)" == PONG ]]; }
online_web() { curl --silent --fail --max-time 3 http://127.0.0.1:3000/api  >/dev/null 2>&1 || curl --silent --output /dev/null --max-time 3 http://127.0.0.1:3000/login 2>/dev/null; }
online_worker() { pgrep -u chatwoot -f '[s]idekiq' >/dev/null 2>&1; }

proc_start_ticks() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }
proc_cmdline() { tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null; }
proc_cwd() { readlink -f "/proc/$1/cwd" 2>/dev/null; }

status() {
  if online_pg; then echo 'Chatwoot PostgreSQL: ONLINE (16/main, 127.0.0.1:5433)'; else echo 'Chatwoot PostgreSQL: OFFLINE'; fi
  if online_redis; then echo 'Chatwoot Redis: ONLINE (127.0.0.1:6380)'; else echo 'Chatwoot Redis: OFFLINE'; fi
  if online_web; then echo 'Chatwoot Web: ONLINE (127.0.0.1:3000)'; else echo 'Chatwoot Web: OFFLINE'; fi
  if online_worker; then echo 'Chatwoot Worker: ONLINE'; else echo 'Chatwoot Worker: OFFLINE'; fi
}

record_pid() {
  local service="$1" pid="$2"
  printf '%s|%s\n' "$pid" "$(proc_start_ticks "$pid")" > "$STATE_DIR/$service.pid"
  chmod 600 "$STATE_DIR/$service.pid"
}

start_pg() {
  if online_pg; then return; fi
  pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start
  for _ in $(seq 1 20); do online_pg && { printf 'started\n' > "$STATE_DIR/postgres16-main.owned"; chmod 600 "$STATE_DIR/postgres16-main.owned"; return; }; sleep 1; done
  echo 'Dedicated Chatwoot PostgreSQL cluster did not become ready.' >&2
  return 1
}

start_redis() {
  if online_redis; then return; fi
  if ss -ltn '( sport = :6380 )' | grep -q LISTEN; then echo 'Port 6380 is occupied by an unverified process; refusing to start Redis.' >&2; return 1; fi
  [[ -d "$REDIS_DIR" ]] || { echo 'Dedicated Chatwoot Redis data directory is missing.' >&2; return 1; }
  runuser -u redis -- redis-server \
    --port 6380 --bind 127.0.0.1 --protected-mode yes \
    --dir "$REDIS_DIR" --appendonly no --dbfilename dump.rdb \
    --daemonize yes --pidfile "$REDIS_PIDFILE" --logfile "$REDIS_LOG"
  for _ in $(seq 1 15); do
    if online_redis; then
      local pid
      pid="$(cat "$REDIS_PIDFILE")"
      [[ "$(proc_cwd "$pid")" == "$REDIS_DIR" ]] || { echo 'Redis started outside its dedicated data directory.' >&2; return 1; }
      record_pid redis "$pid"
      return
    fi
    sleep 1
  done
  echo 'Dedicated Chatwoot Redis did not become ready.' >&2
  return 1
}

start_chatwoot_process() {
  local service="$1" command="$2" log_name="$3"
  local temp_pid
  temp_pid="/tmp/echat-chatwoot-lab-$service.pid"
  if [[ "$service" == web ]] && online_web; then return; fi
  if [[ "$service" == worker ]] && online_worker; then return; fi
  [[ -d "$CHATWOOT_DIR" && -f "$CHATWOOT_ENV" ]] || { echo 'Chatwoot checkout or local .env is missing; refusing default configuration.' >&2; return 1; }
  [[ -x /home/chatwoot/.rbenv/shims/bundle || -x /usr/local/bin/bundle ]] || { echo 'Chatwoot Ruby bundle is unavailable.' >&2; return 1; }
  rm -f "$temp_pid"
  runuser -u chatwoot -- env LAB_COMMAND="$command" LAB_PID_PATH="$temp_pid" LAB_LOG_NAME="$log_name" bash -lc '
    cd /home/chatwoot/chatwoot
    set -a
    . /home/chatwoot/chatwoot/.env
    set +a
    mkdir -p log
    nohup bash -lc "exec $LAB_COMMAND" >> "log/$LAB_LOG_NAME" 2>&1 < /dev/null &
    echo "$!" > "$LAB_PID_PATH"
  '
  [[ -s "$temp_pid" ]] || { echo "Could not record the Chatwoot $service PID." >&2; return 1; }
  local pid
  pid="$(cat "$temp_pid")"
  rm -f "$temp_pid"
  for _ in $(seq 1 25); do
    if [[ "$service" == web ]] && online_web; then record_pid "$service" "$pid"; return; fi
    if [[ "$service" == worker ]] && pgrep -u chatwoot -f '[s]idekiq' >/dev/null 2>&1; then record_pid "$service" "$pid"; return; fi
    if ! kill -0 "$pid" 2>/dev/null; then echo "Chatwoot $service stopped during startup; inspect its LAB log." >&2; return 1; fi
    sleep 1
  done
  echo "Chatwoot $service did not become ready; ownership was not recorded." >&2
  return 1
}

start() {
  start_pg
  start_redis
  start_chatwoot_process web 'bundle exec rails server -b 127.0.0.1 -p 3000' chatwoot-lab-web.log
  start_chatwoot_process worker 'bundle exec sidekiq -C config/sidekiq.yml -c 2' chatwoot-lab-worker.log
  status
}

stop_owned_pid() {
  local service="$1" expected="$2" marker
  marker="$STATE_DIR/$service.pid"
  [[ -f "$marker" ]] || { echo "Chatwoot $service: LEFT RUNNING (not owned by LAB script)"; return; }
  local pid saved_ticks current_ticks cmd cwd
  IFS='|' read -r pid saved_ticks < "$marker"
  if [[ ! -d "/proc/$pid" ]]; then rm -f "$marker"; echo "Chatwoot $service: OFFLINE (owned process already exited)"; return; fi
  current_ticks="$(proc_start_ticks "$pid")"; cmd="$(proc_cmdline "$pid")"; cwd="$(proc_cwd "$pid")"
  if [[ "$current_ticks" != "$saved_ticks" || "$cwd" != "$CHATWOOT_DIR" || "$cmd" != *"$expected"* ]]; then echo "Chatwoot $service: ownership check failed; left running" >&2; return 1; fi
  kill -TERM "$pid"
  for _ in $(seq 1 15); do [[ -d "/proc/$pid" ]] || break; sleep 1; done
  if [[ -d "/proc/$pid" ]]; then echo "Chatwoot $service: did not stop; left running" >&2; return 1; fi
  rm -f "$marker"
  echo "Chatwoot $service: OFFLINE (owned process stopped)"
}

stop() {
  stop_owned_pid web 'puma' || true
  stop_owned_pid worker 'sidekiq' || true
  if [[ -f "$STATE_DIR/redis.pid" ]]; then
    local pid saved_ticks current_ticks cmd cwd
    IFS='|' read -r pid saved_ticks < "$STATE_DIR/redis.pid"
    current_ticks="$(proc_start_ticks "$pid")"; cmd="$(proc_cmdline "$pid")"; cwd="$(proc_cwd "$pid")"
    if [[ -d "/proc/$pid" && "$current_ticks" == "$saved_ticks" && "$cwd" == "$REDIS_DIR" && "$cmd" == *"--port 6380"* ]]; then
      kill -TERM "$pid"; rm -f "$STATE_DIR/redis.pid" "$REDIS_PIDFILE"; echo 'Chatwoot Redis: OFFLINE (owned process stopped)'
    else echo 'Chatwoot Redis: ownership check failed; left running' >&2; fi
  else echo 'Chatwoot Redis: LEFT RUNNING (not owned by LAB script)'; fi
  if [[ -f "$STATE_DIR/postgres16-main.owned" ]]; then
    if pg_isready -h 127.0.0.1 -p "$PG_PORT" -q; then pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" stop; fi
    rm -f "$STATE_DIR/postgres16-main.owned"
    echo 'Chatwoot PostgreSQL: OFFLINE (owned 16/main cluster stopped)'
  else echo 'Chatwoot PostgreSQL: LEFT RUNNING (not owned by LAB script)'; fi
}

case "${1:-status}" in
  status) status ;;
  start) start ;;
  stop) stop ;;
  *) echo 'Usage: chatwoot-lab.sh {status|start|stop}' >&2; exit 2 ;;
esac

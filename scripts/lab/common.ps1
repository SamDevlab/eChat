$script:LabRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$script:LabRuntimeDirectory = Join-Path $script:LabRepoRoot ".runtime\lab"
$script:LabEnvPath = Join-Path $script:LabRepoRoot ".env"

function Read-LabEnvironment {
  if (-not (Test-Path -LiteralPath $script:LabEnvPath -PathType Leaf)) { throw "Local .env is required for LAB operations." }
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $script:LabEnvPath) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $value = $matches[2].Trim()
      if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') -or ($value[0] -eq "'" -and $value[$value.Length - 1] -eq "'"))) { $value = $value.Substring(1, $value.Length - 2) }
      $values[$matches[1]] = $value
    }
  }
  $script:LabEnvironment = $values
  return $values
}

function Get-LabDatabaseTarget([string]$connectionString) {
  if ([string]::IsNullOrWhiteSpace($connectionString)) { throw "DATABASE_URL is required for LAB database operations." }
  try { $uri = [Uri]$connectionString } catch { throw "DATABASE_URL must be a PostgreSQL URL." }
  if ($uri.Scheme -notin @("postgres", "postgresql")) { throw "DATABASE_URL must use PostgreSQL." }
  $database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($database)) { throw "DATABASE_URL must name a database." }
  $userinfo = $uri.UserInfo -split ":", 2
  $query = @{}
  foreach ($pair in ($uri.Query.TrimStart('?') -split '&')) {
    if ($pair -match '^([^=]+)=(.*)$') { $query[[Uri]::UnescapeDataString($matches[1])] = [Uri]::UnescapeDataString($matches[2]) }
  }
  return [pscustomobject]@{
    Host = $uri.Host
    Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
    Database = $database
    Username = if ($userinfo.Count -gt 0) { [Uri]::UnescapeDataString($userinfo[0]) } else { "" }
    Password = if ($userinfo.Count -gt 1) { [Uri]::UnescapeDataString($userinfo[1]) } else { "" }
    SslMode = if ($query.ContainsKey("sslmode")) { $query["sslmode"] } else { "" }
  }
}

function Get-LabDatabaseEnvironment([hashtable]$environment, [pscustomobject]$database) {
  if ($environment.ContainsKey("DATABASE_ENV") -and -not [string]::IsNullOrWhiteSpace($environment["DATABASE_ENV"])) { return $environment["DATABASE_ENV"].ToUpperInvariant() }
  if ($database.Database -eq "echat_test") { return "TEST" }
  return "UNCLASSIFIED"
}

function Assert-LabDatabaseTarget([hashtable]$environment) {
  $nodeEnvironment = if ($environment.ContainsKey("NODE_ENV")) { $environment["NODE_ENV"] } else { "development" }
  if ($nodeEnvironment -eq "production") { throw "LAB scripts refuse NODE_ENV=production." }
  $database = Get-LabDatabaseTarget $environment["DATABASE_URL"]
  if ((Get-LabDatabaseEnvironment $environment $database) -ne "TEST") { throw "LAB scripts require DATABASE_ENV=TEST or an echat_test target for safe inference." }
  if ($database.Database -ne "echat_test") { throw "LAB scripts only operate on echat_test." }
  if ($environment.ContainsKey("DATABASE_URL_TEST")) {
    $testDatabase = Get-LabDatabaseTarget $environment["DATABASE_URL_TEST"]
    if ($testDatabase.Database -ne "echat_test" -or $testDatabase.Host -ne $database.Host -or $testDatabase.Port -ne $database.Port) { throw "DATABASE_URL_TEST must target the same echat_test service." }
  }
  if ($environment["ECHAT_OUTBOUND_MODE"] -ne "disabled") { throw "LAB startup is blocked unless ECHAT_OUTBOUND_MODE=disabled." }
  if (-not [string]::IsNullOrWhiteSpace($environment["ECHAT_OUTBOUND_PILOT_CONVERSATIONS"])) { throw "LAB startup is blocked unless the outbound allowlist is empty." }
  return $database
}

function Get-LabListener([int]$port) {
  return @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Test-LabHttp([string]$url) {
  try {
    $null = Invoke-WebRequest -Uri $url -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
    return $true
  } catch { return $false }
}

function Get-LabProcessMarker([string]$service) { return Join-Path $script:LabRuntimeDirectory ($service + ".json") }

function Start-LabOwnedProcess([string]$service, [string]$npmScript, [int]$port, [string]$healthUrl) {
  if (Test-LabHttp $healthUrl) { return "ONLINE (existing)" }
  if ((Get-LabListener $port).Count -gt 0) { throw "Port $port is occupied by a service that LAB does not own; refusing to replace it." }
  if (-not (Test-Path -LiteralPath (Join-Path $script:LabRepoRoot "node_modules"))) { throw "Run npm ci before starting eChat LAB." }
  New-Item -ItemType Directory -Force -Path $script:LabRuntimeDirectory | Out-Null
  $process = Start-Process -FilePath $env:ComSpec -ArgumentList @("/d", "/c", "npm run $npmScript") -WorkingDirectory $script:LabRepoRoot -PassThru -WindowStyle Hidden
  $marker = [ordered]@{ processId = $process.Id; startedAt = $process.StartTime.ToUniversalTime().ToString("o"); expectedCommand = "npm run $npmScript" }
  $marker | ConvertTo-Json | Set-Content -LiteralPath (Get-LabProcessMarker $service) -Encoding utf8
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-LabHttp $healthUrl) { return "ONLINE (owned by LAB)" }
  }
  throw "eChat $service did not become healthy. Its owned process marker was retained for safe cleanup."
}

function Stop-LabOwnedProcess([string]$service) {
  $markerPath = Get-LabProcessMarker $service
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) { return "LEFT RUNNING (not owned by LAB)" }
  $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($marker.processId)" -ErrorAction SilentlyContinue
  if (-not $process) { Remove-Item -LiteralPath $markerPath -Force; return "OFFLINE (owned process already exited)" }
  $startedAt = ([DateTime]$process.CreationDate).ToUniversalTime()
  if ($marker.startedAt -is [DateTime]) { $expectedAt = ([DateTime]$marker.startedAt).ToUniversalTime() }
  else { $expectedAt = ([DateTimeOffset]::Parse([string]$marker.startedAt, [Globalization.CultureInfo]::InvariantCulture)).UtcDateTime }
  if ([Math]::Abs(($startedAt - $expectedAt).TotalSeconds) -gt 2 -or $process.Name -ne "cmd.exe" -or $process.CommandLine -notlike "*$($marker.expectedCommand)*") {
    throw "Ownership check failed for $service; refusing to stop PID $($marker.processId)."
  }
  & taskkill.exe /PID $marker.processId /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not stop the exact LAB-owned $service process tree." }
  Remove-Item -LiteralPath $markerPath -Force
  return "OFFLINE (LAB-owned process stopped)"
}

function Test-LabDatabase([pscustomobject]$database) {
  try { return ((Invoke-LabDatabaseQuery $database "select current_database()") -eq "echat_test") } catch { return $false }
}

function Invoke-LabDatabaseQuery([pscustomobject]$database, [string]$query) {
  $originalUrl = [Environment]::GetEnvironmentVariable("LAB_DATABASE_URL", "Process")
  $originalQuery = [Environment]::GetEnvironmentVariable("LAB_DATABASE_QUERY", "Process")
  $probe = 'import postgres from "postgres"; const sql=postgres(process.env.LAB_DATABASE_URL,{max:1,connect_timeout:4}); try { const rows=await sql.unsafe(process.env.LAB_DATABASE_QUERY); const first=rows[0]; if(first) console.log(String(Object.values(first)[0] ?? "")); } catch { process.exitCode=1; } finally { await sql.end({timeout:1}); }'
  try {
    $env:LAB_DATABASE_URL = $script:LabEnvironment["DATABASE_URL"]
    if ([string]::IsNullOrWhiteSpace($env:LAB_DATABASE_URL)) { throw "DATABASE_URL is unavailable." }
    $env:LAB_DATABASE_QUERY = $query
    $result = & node --input-type=module -e $probe 2>$null
    if ($LASTEXITCODE -ne 0) { throw "eChat LAB database query failed." }
    return [string]($result | Select-Object -First 1)
  } finally {
    [Environment]::SetEnvironmentVariable("LAB_DATABASE_URL", $originalUrl, "Process")
    [Environment]::SetEnvironmentVariable("LAB_DATABASE_QUERY", $originalQuery, "Process")
  }
}

function Get-LabPostgresTool([string]$name) {
  $command = Get-Command ($name + ".exe") -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$name.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($candidate) { return $candidate.FullName }
  throw "$name.exe was not found. Install PostgreSQL client tools and retry."
}

function Set-LabPostgresEnvironment([pscustomobject]$database) {
  $names = @("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE")
  $original = @{}
  foreach ($name in $names) { $original[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
  $env:PGHOST = $database.Host; $env:PGPORT = [string]$database.Port; $env:PGDATABASE = $database.Database
  if ($database.Username) { $env:PGUSER = $database.Username } else { Remove-Item Env:PGUSER -ErrorAction SilentlyContinue }
  if ($database.Password) { $env:PGPASSWORD = $database.Password } else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  if ($database.SslMode) { $env:PGSSLMODE = $database.SslMode } else { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue }
  return $original
}

function Restore-LabPostgresEnvironment([hashtable]$original) {
  foreach ($name in $original.Keys) { [Environment]::SetEnvironmentVariable($name, $original[$name], "Process") }
}

function Invoke-ChatwootLab([string]$action) {
  $scriptPath = Join-Path $PSScriptRoot "chatwoot-lab.sh"
  if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) { throw "Chatwoot LAB helper is missing." }
  $wslScript = "/mnt/" + $scriptPath.Substring(0, 1).ToLowerInvariant() + $scriptPath.Substring(2).Replace("\", "/")
  $output = & wsl.exe --distribution EChat-Chatwoot-Lab --user root --exec bash $wslScript $action
  if ($LASTEXITCODE -ne 0) { throw "Chatwoot LAB $action failed. Review its sanitized status output." }
  return ($output -join [Environment]::NewLine)
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { loginSchema, type DemoState, type SessionUser } from "@echat/shared";
import { createSeedState } from "./seed-data.js";
import { createStore, DomainError, getConversation, listContacts, listConversations, listOpportunities, assignConversation, sendMessage, createOpportunity, moveOpportunity, processWebhook, type Store } from "./services.js";
import { authenticateLocalUser, createMessagingProvider } from "./providers.js";

const port = Number(process.env.PORT ?? 3001);
const stateFile = resolve(process.cwd(), "data", "dev-state.json");
const sessions = new Map<string, SessionUser>();

const loadState = async (): Promise<DemoState> => {
  try { return JSON.parse(await readFile(stateFile, "utf8")) as DemoState; } catch { return createSeedState(); }
};
const store: Store = createStore(await loadState());
const json = (res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": process.env.APP_URL ?? "http://localhost:5173", "Access-Control-Allow-Credentials": "true", ...headers }); res.end(JSON.stringify(payload)); };
const parseCookies = (header: string | undefined) => Object.fromEntries((header ?? "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
const firstHeader = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value;
const readRawBody = (req: IncomingMessage): Promise<string> => new Promise((resolveBody, reject) => { let raw = ""; req.on("data", (chunk: Buffer) => { raw += chunk.toString(); }); req.on("end", () => resolveBody(raw)); req.on("error", reject); });
const readBody = async (req: IncomingMessage): Promise<unknown> => { const raw = await readRawBody(req); try { return raw ? JSON.parse(raw) : {}; } catch { throw new DomainError(400, "JSON inválido"); } };
const requireSession = (req: IncomingMessage) => { const token = parseCookies(req.headers.cookie).echat_session; const user = token ? sessions.get(token) : undefined; if (!user) throw new DomainError(401, "Sessão necessária"); return user; };
const persist = async () => { try { const { mkdir, writeFile } = await import("node:fs/promises"); await mkdir(resolve(process.cwd(), "data"), { recursive: true }); await writeFile(stateFile, JSON.stringify(store.state, null, 2), "utf8"); } catch { /* local demo remains usable without disk persistence */ } };

const route = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": process.env.APP_URL ?? "http://localhost:5173", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS" }); res.end(); return; }
  if (url.pathname === "/api/health") { json(res, 200, { ok: true, provider: process.env.MESSAGING_PROVIDER ?? "mock" }); return; }
  try {
    if (req.method === "POST" && url.pathname === "/api/v1/auth/login") {
      const input = loginSchema.parse(await readBody(req));
      const user = authenticateLocalUser(store.state, input.email, input.password);
      if (!user) { json(res, 401, { error: "Email ou senha inválidos" }); return; }
      const token = randomUUID();
      sessions.set(token, { ...user, sessionId: token });
      json(res, 200, { user }, { "Set-Cookie": `echat_session=${token}; HttpOnly; SameSite=Lax; Path=/` }); return;
    }
    if (req.method === "POST" && url.pathname === "/api/v1/auth/logout") { const token = parseCookies(req.headers.cookie).echat_session; if (token) sessions.delete(token); json(res, 200, { ok: true }, { "Set-Cookie": "echat_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" }); return; }
    const user = requireSession(req);
    if (req.method === "GET" && url.pathname === "/api/v1/auth/me") { json(res, 200, { user }); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/bootstrap") { json(res, 200, { organization: store.state.organization, user, users: store.state.users.filter((item) => item.organizationId === user.organizationId), contacts: listContacts(store, user), channels: store.state.channels.filter((item) => item.organizationId === user.organizationId), conversations: listConversations(store, user), stages: store.state.stages.filter((item) => item.organizationId === user.organizationId), opportunities: listOpportunities(store, user) }); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/contacts") { json(res, 200, { contacts: listContacts(store, user) }); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/conversations") { json(res, 200, { conversations: listConversations(store, user) }); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/opportunities") { json(res, 200, { opportunities: listOpportunities(store, user) }); return; }
    const conversationMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)$/);
    if (req.method === "GET" && conversationMatch) { json(res, 200, getConversation(store, user, conversationMatch[1])); return; }
    const messageMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/);
    if (req.method === "POST" && messageMatch) { const message = await sendMessage(store, user, messageMatch[1], await readBody(req)); await persist(); json(res, 201, { message }); return; }
    const assignMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/assign$/);
    if (req.method === "PATCH" && assignMatch) { const body = await readBody(req) as { assignedToId?: string }; const conversation = assignConversation(store, user, assignMatch[1], body.assignedToId); await persist(); json(res, 200, { conversation }); return; }
    if (req.method === "POST" && url.pathname === "/api/v1/opportunities") { const opportunity = createOpportunity(store, user, await readBody(req)); await persist(); json(res, 201, { opportunity }); return; }
    const moveMatch = url.pathname.match(/^\/api\/v1\/opportunities\/([^/]+)\/move$/);
    if (req.method === "PATCH" && moveMatch) { const opportunity = moveOpportunity(store, user, moveMatch[1], await readBody(req)); await persist(); json(res, 200, { opportunity }); return; }
    if (req.method === "POST" && url.pathname === "/api/v1/webhooks/chatwoot") { const rawBody = await readRawBody(req); const provider = createMessagingProvider(); const headers = { "x-chatwoot-timestamp": firstHeader(req.headers["x-chatwoot-timestamp"]), "x-chatwoot-signature": firstHeader(req.headers["x-chatwoot-signature"]) }; if (process.env.MESSAGING_PROVIDER === "chatwoot" && !provider.verifyWebhook(headers, rawBody)) throw new DomainError(401, "Assinatura Chatwoot inválida"); const eventId = req.headers["x-chatwoot-delivery"] ?? req.headers["x-chatwoot-event-id"]; if (typeof eventId !== "string") throw new DomainError(400, "X-Chatwoot-Delivery obrigatório"); let payload: unknown; try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch { throw new DomainError(400, "JSON inválido"); } json(res, 200, processWebhook(store, user, eventId, payload)); return; }
    json(res, 404, { error: "Rota não encontrada" });
  } catch (error) {
    if (error instanceof DomainError) { json(res, error.status, { error: error.message }); return; }
    if (error instanceof Error && error.name === "ZodError") { json(res, 422, { error: error.message }); return; }
    console.error(error); json(res, 500, { error: "Erro interno" });
  }
};

const server = createServer((req, res) => { void route(req, res); });
server.listen(port, () => console.log(`eChat API listening on http://localhost:${port}`));

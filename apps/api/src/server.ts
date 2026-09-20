import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { loginSchema } from "@echat/shared";
import { createDatabase } from "@echat/db";
import { createSessionToken, hashSessionToken, verifyPassword } from "./auth.js";
import { createMessagingProvider } from "./providers.js";
import { DomainError, DomainServices } from "./services.js";
import { Repositories } from "./repositories.js";

const port = Number(process.env.PORT ?? 3001);
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const cookieName = process.env.SESSION_COOKIE_NAME ?? "echat_session";
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 168);
const sessionSecret = process.env.SESSION_SECRET ?? "development-only-change-me";
const maxBodyBytes = 1_048_576;
const { db, client } = createDatabase();
const repositories = new Repositories(db);
const provider = createMessagingProvider();
const services = new DomainServices(repositories, provider);
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const json = (res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Vary": "Origin", ...headers }); res.end(JSON.stringify(payload)); };
const parseCookies = (header: string | undefined): Record<string, string> => Object.fromEntries((header ?? "").split(";").map((part) => { const index = part.indexOf("="); return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]; }).filter(([key, value]) => Boolean(key && value)));
const firstHeader = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value;
const sessionHash = (token: string) => hashSessionToken(`${token}.${sessionSecret}`);
const secureCookie = process.env.NODE_ENV === "production" || appUrl.startsWith("https://");
const sessionCookie = (token: string, maxAge: number) => `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookie ? "; Secure" : ""}`;

const readRawBody = (req: IncomingMessage, limit = maxBodyBytes): Promise<string> => new Promise((resolveBody, reject) => {
  let raw = ""; let size = 0; let settled = false;
  req.on("data", (chunk: Buffer) => { if (settled) return; size += chunk.byteLength; if (size > limit) { settled = true; reject(new DomainError(413, "Payload muito grande")); req.resume(); return; } raw += chunk.toString("utf8"); });
  req.on("end", () => { if (!settled) { settled = true; resolveBody(raw); } }); req.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
});
const readBody = async (req: IncomingMessage): Promise<unknown> => { const raw = await readRawBody(req); try { return raw ? JSON.parse(raw) : {}; } catch { throw new DomainError(400, "JSON inválido"); } };
const rejectForeignOrigin = (req: IncomingMessage) => { const origin = firstHeader(req.headers.origin); if (origin && origin !== appUrl) throw new DomainError(403, "Origem não permitida"); };
const requireSession = async (req: IncomingMessage) => { const token = parseCookies(req.headers.cookie)[cookieName]; if (!token) throw new DomainError(401, "Sessão necessária"); const session = await repositories.findSession(sessionHash(token)); if (!session) throw new DomainError(401, "Sessão necessária"); return session.user; };
const takeLoginAttempt = (key: string): boolean => { const now = Date.now(); const current = loginAttempts.get(key); if (!current || current.resetAt <= now) { loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 }); return true; } if (current.count >= 10) return false; current.count += 1; return true; };
const externalAccountFromPayload = (payload: unknown): string | undefined => { if (!payload || typeof payload !== "object") return undefined; const value = payload as Record<string, unknown>; const account = value.account; if (account && typeof account === "object") { const accountRecord = account as Record<string, unknown>; if (typeof accountRecord.id === "string" || typeof accountRecord.id === "number") return String(accountRecord.id); } if (typeof value.account_id === "string" || typeof value.account_id === "number") return String(value.account_id); return process.env.CHATWOOT_ACCOUNT_ID || (process.env.MESSAGING_PROVIDER === "mock" ? "mock" : undefined); };

const route = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "OPTIONS") { const origin = firstHeader(req.headers.origin); if (origin && origin !== appUrl) { res.writeHead(403); res.end(); return; } res.writeHead(204, { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Chatwoot-Timestamp, X-Chatwoot-Signature, X-Chatwoot-Delivery", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS" }); res.end(); return; }
  if (url.pathname === "/api/health") { json(res, 200, { ok: true, provider: provider.name }); return; }
  try {
    if (req.method === "POST" && url.pathname === "/api/v1/auth/login") {
      rejectForeignOrigin(req); const attemptKey = req.socket.remoteAddress ?? "unknown"; if (!takeLoginAttempt(attemptKey)) throw new DomainError(429, "Muitas tentativas. Tente novamente mais tarde.");
      const input = loginSchema.parse(await readBody(req)); const found = await repositories.authenticate(input.email); if (!found || !verifyPassword(input.password, found.passwordHash)) { json(res, 401, { error: "Email ou senha inválidos" }); return; }
      const token = createSessionToken(); const ttlSeconds = Math.max(300, sessionTtlHours * 3600); await repositories.createSession({ id: randomUUID(), userId: found.userId, organizationId: found.user.organizationId, tokenHash: sessionHash(token), expiresAt: new Date(Date.now() + ttlSeconds * 1000) });
      json(res, 200, { user: found.user }, { "Set-Cookie": sessionCookie(token, ttlSeconds) }); return;
    }
    if (req.method === "POST" && url.pathname === "/api/v1/auth/logout") { rejectForeignOrigin(req); const token = parseCookies(req.headers.cookie)[cookieName]; if (token) { const session = await repositories.findSession(sessionHash(token)); if (session) await repositories.revokeSession(session.sessionId); } json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) }); return; }
    if (req.method === "POST" && url.pathname === "/api/v1/webhooks/chatwoot") {
      const rawBody = await readRawBody(req); const rawPayload: unknown = (() => { try { return rawBody ? JSON.parse(rawBody) : {}; } catch { throw new DomainError(400, "JSON inválido"); } })();
      if (process.env.MESSAGING_PROVIDER === "chatwoot" && !provider.verifyWebhook?.({ "x-chatwoot-timestamp": firstHeader(req.headers["x-chatwoot-timestamp"]), "x-chatwoot-signature": firstHeader(req.headers["x-chatwoot-signature"]) }, rawBody)) throw new DomainError(401, "Assinatura Chatwoot inválida");
      const externalAccountId = externalAccountFromPayload(rawPayload); if (!externalAccountId) throw new DomainError(400, "Conta externa ausente"); const integration = await repositories.findIntegration(provider.name, externalAccountId); if (!integration) throw new DomainError(404, "Integração não encontrada");
      const eventId = firstHeader(req.headers["x-chatwoot-delivery"]) ?? firstHeader(req.headers["x-chatwoot-event-id"]) ?? (rawPayload && typeof rawPayload === "object" && (typeof (rawPayload as Record<string, unknown>).id === "string" || typeof (rawPayload as Record<string, unknown>).id === "number") ? String((rawPayload as Record<string, unknown>).id) : undefined); if (!eventId) throw new DomainError(400, "X-Chatwoot-Delivery obrigatório");
      json(res, 200, await services.processWebhook({ integrationAccountId: integration.id, organizationId: integration.organizationId, provider: provider.name, eventId, rawBody, payload: rawPayload })); return;
    }
    const user = await requireSession(req);
    if (["POST", "PATCH", "DELETE"].includes(req.method ?? "")) rejectForeignOrigin(req);
    if (req.method === "GET" && url.pathname === "/api/v1/auth/me") { json(res, 200, { user }); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/bootstrap") { json(res, 200, await services.bootstrap(user)); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/contacts") { json(res, 200, { contacts: await services.listContacts(user) }); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/conversations") { json(res, 200, { conversations: await services.listConversations(user) }); return; }
    if (req.method === "GET" && url.pathname === "/api/v1/opportunities") { json(res, 200, { opportunities: await services.listOpportunities(user) }); return; }
    const conversationMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)$/); if (req.method === "GET" && conversationMatch) { json(res, 200, await services.getConversation(user, conversationMatch[1])); return; }
    const messageMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/); if (req.method === "POST" && messageMatch) { json(res, 201, { message: await services.sendMessage(user, messageMatch[1], await readBody(req)) }); return; }
    const assignMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/assign$/); if (req.method === "PATCH" && assignMatch) { json(res, 200, { conversation: await services.assignConversation(user, assignMatch[1], await readBody(req)) }); return; }
    const statusMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/(resolve|reopen)$/); if (req.method === "POST" && statusMatch) { json(res, 200, { conversation: await services.updateConversationStatus(user, statusMatch[1], { status: statusMatch[2] === "resolve" ? "RESOLVED" : "OPEN" }) }); return; }
    if (req.method === "POST" && url.pathname === "/api/v1/opportunities") { json(res, 201, { opportunity: await services.createOpportunity(user, await readBody(req)) }); return; }
    const moveMatch = url.pathname.match(/^\/api\/v1\/opportunities\/([^/]+)\/move$/); if (req.method === "PATCH" && moveMatch) { json(res, 200, { opportunity: await services.moveOpportunity(user, moveMatch[1], await readBody(req)) }); return; }
    json(res, 404, { error: "Rota não encontrada" });
  } catch (error) {
    if (error instanceof DomainError) { json(res, error.status, { error: error.message }); return; }
    if (error instanceof Error && error.name === "ZodError") { json(res, 422, { error: "Dados inválidos" }); return; }
    console.error(`[api] ${req.method ?? "?"} ${req.url ?? "?"}:`, error instanceof Error ? error.message : "erro desconhecido"); json(res, 500, { error: "Erro interno" });
  }
};

const server = createServer((req, res) => { void route(req, res); });
server.listen(port, () => console.log(`eChat API listening on http://localhost:${port} using PostgreSQL`));
const shutdown = () => { server.close(() => { void client.end(); }); };
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);

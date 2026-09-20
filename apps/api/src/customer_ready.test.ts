import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { authSessions, createDatabase, organizationInvites, organizationMembers, organizations, pipelineStages, pipelines, users } from "@echat/db";
import { hashSessionToken } from "./auth.js";
import { MockMessagingProvider } from "./providers.js";
import { Repositories } from "./repositories.js";
import { DomainServices } from "./services.js";

const databaseUrl = process.env.DATABASE_URL_TEST;
const runtime = databaseUrl ? createDatabase(databaseUrl) : null;
const describeDb = describe.skipIf(!databaseUrl);

describeDb("customer-ready organization workflows", () => {
  if (!runtime) return;
  const { db, client } = runtime; const repositories = new Repositories(db); const services = new DomainServices(repositories, new MockMessagingProvider()); let organizationId = ""; let ownerId = ""; let inviteId = "";
  beforeAll(async () => { await db.delete(organizationInvites).where(eq(organizationInvites.email, "customer-ready-invite@local")); await db.delete(authSessions).where(eq(authSessions.tokenHash, hashSessionToken("customer-ready-session"))); });
  afterAll(async () => { if (organizationId) { await db.delete(organizationInvites).where(eq(organizationInvites.organizationId, organizationId)); await db.delete(authSessions).where(eq(authSessions.organizationId, organizationId)); await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, organizationId)); await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, organizationId)); await db.delete(pipelines).where(eq(pipelines.organizationId, organizationId)); await db.delete(organizations).where(eq(organizations.id, organizationId)); } await db.delete(users).where(inArray(users.email, ["customer-ready-owner@local", "customer-ready-invite@local"])); await client.end(); });
  it("creates an isolated organization, owner, pipeline, invite, and membership", async () => {
    const signup = await services.signup({ name: "Pilot Owner", email: "customer-ready-owner@local", password: "pilot-password-123", organizationName: "Piloto eChat", session: { id: "customer-ready-session", tokenHash: hashSessionToken("customer-ready-session"), expiresAt: new Date(Date.now() + 60_000) } }); organizationId = signup.organizationId; ownerId = signup.userId;
    const session = await repositories.findSession(hashSessionToken("customer-ready-session")); expect(session?.user.organizationId).toBe(organizationId); expect((await repositories.listStages(organizationId))).toHaveLength(6); expect((await repositories.listContacts(organizationId))).toHaveLength(0);
    const invite = await services.createInvite(session!.user, { email: "customer-ready-invite@local", role: "AGENT", appUrl: "http://localhost:5173" }); inviteId = invite.invite.id; const token = invite.inviteUrl.split("/").pop()!; expect(invite.inviteUrl).toContain("/invite/"); expect((await repositories.findInviteByHash(hashSessionToken(token)))?.tokenHash).not.toContain(token);
    const accepted = await services.acceptInvite({ token, name: "Pilot Agent", password: "agent-password-123", session: { id: "customer-ready-agent-session", tokenHash: hashSessionToken("customer-ready-agent-session"), expiresAt: new Date(Date.now() + 60_000) } }); expect(accepted.organizationId).toBe(organizationId); expect((await repositories.listMembers(organizationId)).some((member) => member.email === "customer-ready-invite@local" && member.role === "AGENT")).toBe(true);
  });
  it("protects the last owner", async () => { const session = await repositories.findSession(hashSessionToken("customer-ready-session")); await expect(services.updateMember(session!.user, ownerId, { role: "ADMIN" })).rejects.toMatchObject({ status: 422 }); expect(inviteId).toBeTruthy(); });
});

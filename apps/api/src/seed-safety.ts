export const assertDemoSeedAllowed = (env: NodeJS.ProcessEnv = process.env): void => {
  if (env.NODE_ENV === "production") throw new Error("Seed demo bloqueado quando NODE_ENV=production");
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Seed demo bloqueado: DATABASE_URL ausente; configure somente o banco echat_test");
  let databaseName = "";
  try { databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, "")); }
  catch { throw new Error("Seed demo bloqueado: DATABASE_URL inválida"); }
  if (databaseName !== "echat_test" || env.DATABASE_ENV?.trim().toUpperCase() && env.DATABASE_ENV.trim().toUpperCase() !== "TEST") {
    throw new Error("Seed demo permitido somente no banco echat_test com DATABASE_ENV=TEST");
  }
  if (env.ECHAT_ALLOW_DEMO_SEED !== "1") throw new Error("Seed demo bloqueado; habilite ECHAT_ALLOW_DEMO_SEED=1 explicitamente para dados sintéticos");
};

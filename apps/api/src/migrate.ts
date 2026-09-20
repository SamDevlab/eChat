import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDatabase } from "@echat/db";

const { client } = createDatabase();
try {
  await client.unsafe("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const folder = resolve(process.cwd(), "../../packages/db/drizzle");
  const files = (await readdir(folder)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const applied = await client.unsafe<{ id: string }[]>("SELECT id FROM schema_migrations WHERE id = $1", [file]);
    if (applied.length > 0) continue;
    const sql = await readFile(resolve(folder, file), "utf8");
    await client.begin(async (transaction) => {
      await transaction.unsafe(sql);
      await transaction.unsafe("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
    });
    console.log(`Migration aplicada: ${file}`);
  }
} finally {
  await client.end();
}

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDatabase>["db"];
export type SqlClient = ReturnType<typeof postgres>;

export const createDatabase = (url = process.env.DATABASE_URL) => {
  if (!url) throw new Error("DATABASE_URL é obrigatório para o runtime do eChat");
  const client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10, prepare: false });
  return { db: drizzle(client, { schema }), client };
};

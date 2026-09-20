import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSeedState } from "./seed-data.js";

const output = resolve(process.cwd(), "data", "dev-state.json");
await mkdir(resolve(process.cwd(), "data"), { recursive: true });
await writeFile(output, JSON.stringify(createSeedState(), null, 2), "utf8");
console.log(`Seed local criado em ${output}`);

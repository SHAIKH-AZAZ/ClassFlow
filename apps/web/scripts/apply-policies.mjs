import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const sqlPath = resolve(here, "../../../supabase/policies.sql");
const sql = readFileSync(sqlPath, "utf8");

const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`;
console.log("Pasting SQL into Supabase requires a SQL editor or service-role REST RPC. The SQL is below for manual application:");
console.log("---BEGIN---");
console.log(sql);
console.log("---END---");
console.log("Length:", sql.length, "chars");
console.log("Use the Supabase SQL Editor to run this once. Alternatively run via psql with the project's pooler URL.");

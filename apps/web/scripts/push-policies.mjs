// Push supabase/policies.sql to the live database via the Supabase Postgres
// meta API. Uses the service role key from apps/web/.env.local.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const sql = readFileSync(resolve(here, "../../../supabase/policies.sql"), "utf8");
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/pg-meta/default/query`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ query: sql })
});

const text = await res.text();
console.log("status", res.status);
console.log(text.slice(0, 1500));
if (!res.ok) process.exit(1);

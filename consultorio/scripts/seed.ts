import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../lib/db");
  const { sembrar } = await import("../lib/db/seed");
  await sembrar(getDb());
  console.log("Seed cargado.");
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);

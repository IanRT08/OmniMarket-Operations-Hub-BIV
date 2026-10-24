// `npx prisma db seed` → misma función que POST /api/test/reset-data.
// dotenv va primero: db.ts lee DATABASE_URL al evaluarse.
import "dotenv/config";

import { resetTestData } from "@/server/dal/test-data";
import { db } from "@/server/db";

async function main() {
  const summary = await resetTestData();
  console.log("Seed aplicado:", summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

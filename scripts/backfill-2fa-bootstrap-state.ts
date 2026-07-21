import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  const activeCredentials = await prisma.twoFactorCredential.count({
    where: { status: "ACTIVE" },
  });

  if (activeCredentials === 0) {
    console.log("Bootstrap 2FA rămâne disponibil: nu există credențiale active.");
    return;
  }

  const current = await prisma.applicationSecurityState.findUnique({
    where: { id: "global" },
    select: { twoFactorBootstrapCompletedAt: true },
  });
  if (current?.twoFactorBootstrapCompletedAt) {
    console.log("Bootstrap 2FA era deja marcat ca finalizat.");
    return;
  }

  const now = new Date();
  await prisma.applicationSecurityState.upsert({
    where: { id: "global" },
    create: { id: "global", twoFactorBootstrapCompletedAt: now },
    update: { twoFactorBootstrapCompletedAt: now },
  });
  console.log("Bootstrap 2FA marcat ca finalizat pentru instalarea existentă.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Backfill 2FA eșuat.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

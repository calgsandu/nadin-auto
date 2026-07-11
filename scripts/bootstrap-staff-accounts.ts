import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "better-auth/crypto";
import { normalizeUsername, validateUsername } from "../src/lib/auth/username";
import { needsPasswordCredential } from "../src/lib/staff/bootstrap";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

function usernameBase(user: { email: string | null; name: string | null }) {
  const source = user.email?.split("@")[0] || user.name || "utilizator";
  const ascii = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 32);
  const normalized = normalizeUsername(ascii);
  return validateUsername(normalized) ? "utilizator" : normalized;
}

function uniqueUsername(base: string, used: Set<string>) {
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, 32 - tail.length)}${tail}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`Nu s-a putut genera un username unic pentru ${base}.`);
}

async function main() {
  const users = await prisma.appUser.findMany({
    orderBy: { createdAt: "asc" },
  });
  const used = new Set(
    users.flatMap((user) => (user.username ? [normalizeUsername(user.username)] : [])),
  );
  let updated = 0;
  let credentialsAdded = 0;

  for (const user of users) {
    let username = user.username ? normalizeUsername(user.username) : null;
    if (!username) {
      username = uniqueUsername(usernameBase(user), used);
      await prisma.appUser.update({
        where: { id: user.id },
        data: { username },
      });
      updated += 1;
    }
    used.add(username);

    if (user.role === "ADMIN") {
      await prisma.$executeRaw`
        UPDATE neon_auth."user"
        SET role = 'admin'
        WHERE id::text = ${user.authUserId}
      `;

      const accounts = await prisma.$queryRaw<Array<{ providerId: string }>>`
        SELECT "providerId"
        FROM neon_auth.account
        WHERE "userId"::text = ${user.authUserId}
      `;
      if (needsPasswordCredential(accounts.map((account) => account.providerId))) {
        const bootstrapPassword = process.env.NADIN_BOOTSTRAP_PASSWORD;
        if (!bootstrapPassword || bootstrapPassword.length < 8) {
          throw new Error(
            `Administratorul ${username} nu are parolă. Rulează o singură dată cu NADIN_BOOTSTRAP_PASSWORD setată la o parolă de minimum 8 caractere.`,
          );
        }
        const passwordHash = await hashPassword(bootstrapPassword);
        await prisma.$executeRaw`
          INSERT INTO neon_auth.account
            ("accountId", "providerId", "userId", "password", "updatedAt")
          VALUES
            (${user.authUserId}, 'credential', CAST(${user.authUserId} AS uuid), ${passwordHash}, NOW())
        `;
        credentialsAdded += 1;
      }
    }
  }

  const activeAdmins = await prisma.appUser.findMany({
    where: { role: "ADMIN", active: true, username: { not: null } },
    select: { username: true },
  });
  if (activeAdmins.length === 0) {
    throw new Error("Nu există niciun administrator activ cu username.");
  }

  console.log(
    `Bootstrap personal finalizat: ${updated} username-uri completate; ${credentialsAdded} credentiale adăugate; administratori activi: ${activeAdmins
      .map((user) => user.username)
      .join(", ")}.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Bootstrap eșuat.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

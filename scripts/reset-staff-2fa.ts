import { createInterface } from "node:readline/promises";
import {
  expectedBreakGlassConfirmation,
  parseBreakGlassArgs,
} from "../src/lib/staff/break-glass";

const usage = `Utilizare:
  pnpm staff:reset-2fa --username <exact> --reason <motiv>

Comanda necesită un terminal interactiv și confirmarea exactă RESET <username>.`;

async function main() {
  const input = parseBreakGlassArgs(process.argv.slice(2));
  if ("help" in input) {
    console.log(usage);
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Comanda break-glass necesită un terminal interactiv.");
  }

  const [
    { prisma },
    { resetTwoFactorCredential },
    { replaceEnrollmentGrant },
    { revokeAuthSessions },
  ] =
    await Promise.all([
      import("../src/lib/prisma"),
      import("../src/lib/auth/two-factor/reset"),
      import("../src/lib/auth/two-factor/enrollment-grant"),
      import("../src/lib/staff/auth-admin"),
    ]);

  try {
    const target = await prisma.appUser.findUnique({
      where: { username: input.username },
      select: {
        id: true,
        authUserId: true,
        username: true,
        name: true,
        role: true,
        active: true,
      },
    });
    if (!target) throw new Error("Utilizatorul nu există.");

    console.log({
      id: target.id,
      username: target.username,
      name: target.name,
      role: target.role,
      active: target.active,
    });

    const confirmation = expectedBreakGlassConfirmation(input.username);
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    let answer: string;
    try {
      answer = await readline.question(`Tastează ${confirmation}: `);
    } finally {
      readline.close();
    }
    if (answer !== confirmation) throw new Error("Confirmare anulată.");

    const now = new Date();
    const activation = await prisma.$transaction(async (tx) => {
      await resetTwoFactorCredential(tx, target.id, now);
      const issued = await replaceEnrollmentGrant(tx, target.id, now);
      await tx.auditLog.create({
        data: {
          userId: null,
          userName: "BREAK_GLASS",
          userEmail: null,
          action: "UPDATE",
          entity: "AppUser",
          entityId: target.id,
          summary: `Resetare 2FA break-glass pentru ${target.username}`,
          details: {
            username: target.username,
            reason: input.reason,
            twoFactorReset: true,
            breakGlass: true,
            enrollmentGrantIssued: true,
            expiresAt: issued.expiresAt.toISOString(),
          },
          reviewStatus: "APPROVED",
        },
      });
      return issued;
    });

    console.log(`Cod activare 2FA (afișat o singură dată): ${activation.code}`);
    console.log(`Codul expiră la ${activation.expiresAt.toISOString()}.`);
    try {
      await revokeAuthSessions(target.authUserId);
    } catch {
      throw new Error(
        "ATENȚIE: resetarea locală și codul nou sunt valide, dar sesiunile Neon nu au putut fi revocate.",
      );
    }
    console.log(`2FA a fost resetat pentru ${target.username}; sesiunile Neon au fost revocate.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Resetarea 2FA a eșuat.");
  process.exitCode = 1;
});

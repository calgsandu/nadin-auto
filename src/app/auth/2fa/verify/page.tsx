import { redirect } from "next/navigation";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { TwoFactorShell } from "../two-factor-shell";
import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export default async function TwoFactorVerifyPage() {
  const state = await getAuthAccessState();
  if (state.kind !== "TOTP_REQUIRED") redirect("/auth/2fa/continue");

  return (
    <TwoFactorShell
      title="Confirmă autentificarea"
      description="Introdu codul curent de 6 cifre din aplicația Authenticator pentru a continua în CRM."
    >
      <VerifyForm credentialId={state.credentialId} />
    </TwoFactorShell>
  );
}

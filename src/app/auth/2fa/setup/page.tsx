import Image from "next/image";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { getEnrollmentSetupState } from "@/lib/auth/two-factor/enrollment";
import { TwoFactorShell } from "../two-factor-shell";
import { ActivationForm } from "./activation-form";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function TwoFactorSetupPage() {
  const state = await getAuthAccessState();
  if (state.kind === "UNAUTHENTICATED") redirect("/auth/sign-in");
  if (state.kind === "TOTP_REQUIRED") redirect("/auth/2fa/verify");
  if (state.kind === "AUTHENTICATED") redirect("/crm");

  const setup = await getEnrollmentSetupState(state.primary);
  if (setup.kind === "ACTIVATION_REQUIRED") {
    return (
      <TwoFactorShell
        title="Activează Authenticator"
        description="Pentru securitate, configurarea 2FA începe numai cu un cod unic primit de la administrator pe un canal separat."
      >
        <ActivationForm />
      </TwoFactorShell>
    );
  }

  const enrollment = setup.enrollment;
  const qrDataUrl = await QRCode.toDataURL(enrollment.uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });

  return (
    <TwoFactorShell
      title="Configurează Authenticator"
      description="Acest pas este obligatoriu pentru toate conturile. Scanează codul, apoi confirmă cu primul cod generat de aplicație."
    >
      <div className="grid gap-6">
        <div className="mx-auto rounded-2xl border border-[#e8e7e3] bg-white p-3">
          <Image
            src={qrDataUrl}
            alt="Cod QR pentru configurarea aplicației Authenticator"
            width={240}
            height={240}
            unoptimized
            priority
          />
        </div>
        <SetupForm
          credentialId={enrollment.credentialId}
          manualSecret={enrollment.secret}
          expiresAt={enrollment.expiresAt.toISOString()}
        />
      </div>
    </TwoFactorShell>
  );
}

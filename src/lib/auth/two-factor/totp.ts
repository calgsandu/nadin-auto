import * as OTPAuth from "otpauth";

const ISSUER = "Nadin Auto";
const PERIOD_SECONDS = 30;
const PERIOD_MS = PERIOD_SECONDS * 1_000;

function createTotp(username: string, secret: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function createTotpEnrollment(username: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  return { secret, uri: createTotpUri(secret, username) };
}

export function createTotpUri(secret: string, username: string) {
  return createTotp(username, secret).toString();
}

export function matchTotpStep(
  secret: string,
  username: string,
  code: string,
  timestampMs = Date.now(),
) {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = createTotp(username, secret).validate({
    token: code,
    timestamp: timestampMs,
    window: 1,
  });
  return delta === null ? null : Math.floor(timestampMs / PERIOD_MS) + delta;
}

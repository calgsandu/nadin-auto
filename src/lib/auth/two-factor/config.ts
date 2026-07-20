export type TwoFactorConfig = {
  encryptionKey: Buffer;
  rateLimitPepper: Buffer;
  proofCookieName: string;
  trustedCookieName: string;
  secureCookies: boolean;
};

function decode32(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing ${name}`);

  const encoded = value.trim();
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error(`${name} must be valid base64 for exactly 32 bytes`);
  }

  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== 32) {
    throw new Error(`${name} must decode to exactly 32 bytes`);
  }
  return bytes;
}

export function readTwoFactorConfig(
  env: Record<string, string | undefined> = process.env,
): TwoFactorConfig {
  const production = env.NODE_ENV === "production";
  return {
    encryptionKey: decode32("TWO_FACTOR_ENCRYPTION_KEY", env.TWO_FACTOR_ENCRYPTION_KEY),
    rateLimitPepper: decode32(
      "TWO_FACTOR_RATE_LIMIT_PEPPER",
      env.TWO_FACTOR_RATE_LIMIT_PEPPER,
    ),
    proofCookieName: production ? "__Host-nadin-2fa-session" : "nadin-2fa-session",
    trustedCookieName: production ? "__Host-nadin-trusted-device" : "nadin-trusted-device",
    secureCookies: production,
  };
}

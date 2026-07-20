import { randomBytes } from "node:crypto";

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ACTIVATION_CODE_BYTES = 10;
const ACTIVATION_CODE_LENGTH = 16;
const ACTIVATION_LIFETIME_MS = 15 * 60_000;

export function generateEnrollmentActivationCode(
  bytes: Buffer = randomBytes(ACTIVATION_CODE_BYTES),
) {
  if (bytes.byteLength !== ACTIVATION_CODE_BYTES) {
    throw new Error("Activation code entropy must be exactly 10 bytes");
  }

  let accumulator = 0;
  let availableBits = 0;
  let encoded = "";
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    availableBits += 8;
    while (availableBits >= 5) {
      availableBits -= 5;
      encoded += CROCKFORD_ALPHABET[(accumulator >> availableBits) & 31];
      accumulator &= (1 << availableBits) - 1;
    }
  }

  if (encoded.length !== ACTIVATION_CODE_LENGTH || availableBits !== 0) {
    throw new Error("Activation code encoding failed");
  }
  return encoded.match(/.{4}/g)!.join("-");
}

export function normalizeEnrollmentActivationCode(value: string) {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, "");
  if (
    normalized.length !== ACTIVATION_CODE_LENGTH
    || !/^[0-9A-HJKMNP-TV-Z]+$/.test(normalized)
  ) {
    throw new Error("Codul de activare nu este valid.");
  }
  return normalized;
}

export function enrollmentActivationExpiry(now: Date) {
  return new Date(now.getTime() + ACTIVATION_LIFETIME_MS);
}

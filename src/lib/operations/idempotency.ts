/**
 * Cheia de idempotență: dacă salvarea pică pe rețea sau depășește timeout-ul
 * funcției, serverul poate să fi scris deja documentul — doar răspunsul s-a
 * pierdut. Reîncercarea trimite ACELAȘI token, iar baza de date e arbitrul:
 * `idempotencyKey` e unic, deci al doilea document nu are cum să apară.
 */
export { newToken } from "@/lib/operations/draft-storage";

export function readToken(formData: FormData) {
  const value = formData.get("idempotencyKey");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Delegatele Prisma care poartă token (StockDocument, PartnerPayment,
 * PaymentAccount) — toate au `number`, deci mesajul poate spune care document e.
 */
type TokenizedModel = {
  findUnique(args: {
    where: { idempotencyKey: string };
    select: { number: true };
  }): Promise<{ number: number } | null>;
};

/** Documentul salvat deja cu token-ul ăsta, dacă există. */
export function findByToken(model: TokenizedModel, token: string) {
  return model.findUnique({ where: { idempotencyKey: token }, select: { number: true } });
}

/**
 * P2002 = încălcare de constrângere unică. Doar cea pe `idempotencyKey`
 * înseamnă „a scris altcineva primul, deci succes"; restul (numărul
 * documentului, numele partenerului) rămân erori adevărate.
 */
export function isDuplicateKeyError(error: unknown, field = "idempotencyKey") {
  if (typeof error !== "object" || error === null) return false;
  const { code, meta, message } = error as { code?: unknown; meta?: unknown; message?: unknown };
  if (code !== "P2002") return false;
  // Forma lui `meta` diferă de la un driver la altul (`target` cu lista de
  // coloane la cel clasic, `driverAdapterError.cause.constraint` la adaptorul
  // Neon) — numele câmpului apare în ea oricum, ca și în mesaj.
  const details = `${JSON.stringify(meta ?? null)} ${typeof message === "string" ? message : ""}`;
  return details.includes(field);
}

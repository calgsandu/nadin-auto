/**
 * Ciorna unei operațiuni: ce a apucat operatorul să completeze, ținută în
 * localStorage ca să supraviețuiască refreshului, crashului de tab și navigării
 * prin sidebar (App Router remontează pagina, iar `beforeunload` nici nu se
 * declanșează atunci).
 *
 * O singură ciornă per tip de operațiune — cea nouă o suprascrie pe cea veche.
 * Modulul e pur: fără DOM, fără localStorage, deci se poate testa direct.
 */

/** Ciorne mai vechi de o săptămână nu mai interesează pe nimeni. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Versiunea cheii: la o schimbare de formă, ciornele vechi devin invizibile. */
const DRAFT_VERSION = "v1";

export type OperationDraft = {
  /** Cheia de idempotență trimisă cu documentul — aceeași la orice reîncercare. */
  token: string;
  savedAt: number;
  /** Câmpurile formularului, în ordinea din DOM (mai multe valori = mai multe rânduri). */
  fields: Record<string, string[]>;
  /** State-ul controlat de React (linii, discount, client ales…) — opac aici. */
  lines: unknown;
};

export function draftKey(kind: string) {
  return `nadin-draft:${DRAFT_VERSION}:${kind}`;
}

export function newToken() {
  return crypto.randomUUID();
}

/**
 * `FormData` → perechi nume/valori. Cheia de idempotență NU intră: ea se ține
 * separat, ca reîncercarea aceleiași ciorne să trimită mereu același token.
 */
export function serializeDraft(
  formData: FormData,
  lines: unknown,
  token: string,
  now = Date.now(),
): OperationDraft {
  const fields: Record<string, string[]> = {};
  for (const [name, value] of formData.entries()) {
    if (name === "idempotencyKey" || typeof value !== "string") continue;
    (fields[name] ??= []).push(value);
  }
  return { token, savedAt: now, fields, lines };
}

/** JSON stricat, formă necunoscută sau ciornă expirată ⇒ `null` (se pornește curat). */
export function parseDraft(
  raw: string | null,
  now: number,
  maxAgeMs = DRAFT_MAX_AGE_MS,
): OperationDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const draft = parsed as Partial<OperationDraft>;
  if (typeof draft.token !== "string" || !draft.token) return null;
  if (typeof draft.savedAt !== "number" || !Number.isFinite(draft.savedAt)) return null;
  if (typeof draft.fields !== "object" || draft.fields === null) return null;
  if (now - draft.savedAt > maxAgeMs) return null;

  const fields: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(draft.fields)) {
    if (!Array.isArray(values)) return null;
    if (values.some((value) => typeof value !== "string")) return null;
    fields[name] = values as string[];
  }

  return { token: draft.token, savedAt: draft.savedAt, fields, lines: draft.lines ?? null };
}

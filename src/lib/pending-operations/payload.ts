import type {
  ParsedPendingOperation,
  PendingOperationKind,
  PendingPaymentFulfillmentPayload,
  PendingSalePayload,
} from "@/lib/pending-operations/types";

export function parsePendingOperationPayload(
  kind: PendingOperationKind,
  value: unknown,
): ParsedPendingOperation {
  if (kind === "SALE") {
    return { kind, payload: parseSalePayload(value) };
  }

  if (kind === "PAYMENT_ACCOUNT_FULFILLMENT") {
    return { kind, payload: parsePaymentFulfillmentPayload(value) };
  }

  throw new Error("Tip de operațiune necunoscut.");
}

function parseSalePayload(value: unknown): PendingSalePayload {
  const record = asRecord(value);
  const warehouseId = readRequiredString(record.warehouseId, "Alege locația.");
  const documentDate = readIsoDate(record.documentDate);
  const partnerId = readOptionalString(record.partnerId);
  const newCustomerName = readOptionalString(record.newCustomerName);
  const notes = readOptionalString(record.notes);
  const cashRegistered = readRequiredBoolean(record.cashRegistered);
  const paymentMethod = readRequiredPaymentMethod(record.paymentMethod);

  if (!Array.isArray(record.lines) || record.lines.length === 0) {
    throw new Error("Adaugă cel puțin un produs.");
  }

  const seen = new Set<string>();
  const lines = record.lines.map((entry, index) => {
    const line = asRecord(entry);
    const productId = readOptionalString(line.productId);
    const externalName = readOptionalString(line.externalName);
    const quantity = Number(line.quantity);
    const unitPriceLei = Number(line.unitPriceLei);
    const unitCostLei =
      line.unitCostLei == null ? null : Number(line.unitCostLei);

    if (!productId && !externalName) {
      throw new Error(`Alege produsul de pe poziția ${index + 1}.`);
    }
    if (productId && seen.has(productId)) {
      throw new Error(
        `Produsul de pe poziția ${index + 1} este adăugat de mai multe ori.`,
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        `Cantitatea de pe poziția ${index + 1} nu este validă.`,
      );
    }
    if (!Number.isFinite(unitPriceLei) || unitPriceLei < 0) {
      throw new Error(`Prețul de pe poziția ${index + 1} nu este valid.`);
    }
    if (unitCostLei !== null && (!Number.isFinite(unitCostLei) || unitCostLei < 0)) {
      throw new Error(`Costul de pe poziția ${index + 1} nu este valid.`);
    }

    if (productId) seen.add(productId);
    return {
      productId,
      externalName: productId ? null : externalName,
      externalCode: productId ? null : readOptionalString(line.externalCode),
      externalSupplierId: productId
        ? null
        : readOptionalString(line.externalSupplierId),
      unitCostLei: productId ? null : unitCostLei,
      quantity,
      unitPriceLei,
    };
  });

  return {
    warehouseId,
    documentDate,
    partnerId,
    newCustomerName,
    notes,
    cashRegistered,
    paymentMethod,
    lines,
  };
}

function readRequiredBoolean(value: unknown) {
  if (typeof value !== "boolean") {
    throw new Error("Alege dacă vânzarea a fost bătută în casă.");
  }
  return value;
}

function readRequiredPaymentMethod(value: unknown): "CASH" | "CARD" {
  if (value === "CASH" || value === "CARD") return value;
  throw new Error("Alege metoda de plată: Cash sau Card.");
}

function parsePaymentFulfillmentPayload(
  value: unknown,
): PendingPaymentFulfillmentPayload {
  const record = asRecord(value);
  return {
    paymentAccountId: readRequiredString(
      record.paymentAccountId,
      "Lipsește contul de plată.",
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Datele operațiunii nu sunt valide.");
  }
  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, message: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(message);
  return normalized;
}

function readOptionalString(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function readIsoDate(value: unknown) {
  const normalized = readRequiredString(
    value,
    "Data documentului nu este validă.",
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Data documentului nu este validă.");
  }
  const parsed = new Date(`${normalized}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error("Data documentului nu este validă.");
  }
  return normalized;
}

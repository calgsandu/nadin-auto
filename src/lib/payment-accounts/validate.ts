export type PaymentAccountInput = {
  warehouseId: string;
  partnerId: string;
  newCustomer?: {
    name: string;
    idno: string;
    address: string;
  };
  issueDate: Date;
  dueDate: Date | null;
  notes: string | null;
  lines: {
    productId: string;
    quantity: number;
    unitPriceGross: number;
  }[];
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string, label: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} nu este validă.`);
  return date;
}

export function parsePaymentAccountForm(formData: FormData): PaymentAccountInput {
  const warehouseId = readString(formData, "warehouseId");
  if (!warehouseId) throw new Error("Alege locația din care va fi predată marfa.");

  const partnerId = readString(formData, "partnerId");
  const newCustomerName = readString(formData, "newCustomerName");
  const newCustomerIdno = readString(formData, "newCustomerIdno");
  const newCustomerAddress = readString(formData, "newCustomerAddress");
  if (!partnerId && !newCustomerName) throw new Error("Alege clientul pentru contul de plată.");
  if (newCustomerName && (!newCustomerIdno || !newCustomerAddress)) {
    throw new Error("Completează IDNO-ul și adresa clientului nou.");
  }

  const issueDate = parseDate(readString(formData, "issueDate"), "Data emiterii");
  const rawDueDate = readString(formData, "dueDate");
  const dueDate = rawDueDate ? parseDate(rawDueDate, "Data scadenței") : null;
  if (dueDate && dueDate < issueDate) {
    throw new Error("Data scadenței nu poate fi înaintea datei emiterii.");
  }

  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const prices = formData.getAll("unitPriceGross").map(String);
  if (productIds.length === 0) throw new Error("Adaugă cel puțin un produs.");

  const seen = new Set<string>();
  const lines = productIds.map((rawProductId, index) => {
    const position = index + 1;
    const productId = rawProductId.trim();
    const quantity = Number(quantities[index] ?? "");
    const unitPriceGross = Number((prices[index] ?? "").trim().replace(",", "."));

    if (!productId) throw new Error(`Alege produsul de pe poziția ${position}.`);
    if (seen.has(productId)) {
      throw new Error(`Produsul de pe poziția ${position} este adăugat de mai multe ori.`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Cantitatea de pe poziția ${position} trebuie să fie mai mare decât zero.`);
    }
    if (!Number.isFinite(unitPriceGross) || unitPriceGross <= 0) {
      throw new Error(`Prețul de pe poziția ${position} trebuie să fie mai mare decât zero.`);
    }

    seen.add(productId);
    return { productId, quantity, unitPriceGross };
  });

  return {
    warehouseId,
    partnerId,
    ...(newCustomerName
      ? { newCustomer: { name: newCustomerName, idno: newCustomerIdno, address: newCustomerAddress } }
      : {}),
    issueDate,
    dueDate,
    notes: readString(formData, "notes") || null,
    lines,
  };
}

export type EFacturaParty = {
  idno: string;
  bankAccount: string | null;
};

export type EFacturaXmlLine = {
  code: string | null;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  unitPriceWithoutVat: number;
  totalWithoutVat: number;
  vatRate: number;
  totalVat: number;
  total: number;
};

export type EFacturaXmlInput = {
  deliveryDate: Date;
  reference: string;
  supplier: EFacturaParty;
  buyer: EFacturaParty;
  lines: EFacturaXmlLine[];
};

export function buildEFacturaXml(input: EFacturaXmlInput) {
  validate(input);

  const merchandise = input.lines.map((line) => (
    `<Row Code="${attribute(line.code ?? "")}" Name="${attribute(line.name)}"` +
    ` UnitOfMeasure="${attribute(line.unitOfMeasure)}" Quantity="${quantity(line.quantity)}"` +
    ` UnitPriceWithoutTVA="${money(line.unitPriceWithoutVat)}"` +
    ` TotalPriceWithoutTVA="${money(line.totalWithoutVat)}" TVA="${rate(line.vatRate)}"` +
    ` TotalTVA="${money(line.totalVat)}" TotalPrice="${money(line.total)}"/>`
  )).join("");

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<Documents><Document><SupplierInfo>",
    `<DeliveryDate>${input.deliveryDate.toISOString()}</DeliveryDate>`,
    party("Supplier", input.supplier),
    party("Buyer", input.buyer),
    `<Merchandises>${merchandise}</Merchandises>`,
    "</SupplierInfo>",
    `<AdditionalInformation><id>${text(input.reference)}</id></AdditionalInformation>`,
    "</Document></Documents>",
  ].join("");
}

function validate(input: EFacturaXmlInput) {
  if (!input.supplier.idno.trim()) throw new Error("Lipsește IDNO-ul furnizorului.");
  if (!input.buyer.idno.trim()) throw new Error("Lipsește IDNO-ul cumpărătorului.");
  if (Number.isNaN(input.deliveryDate.getTime())) throw new Error("Data livrării nu este validă.");
  if (!input.reference.trim()) throw new Error("Lipsește referința documentului.");
  if (input.lines.length === 0) throw new Error("Factura trebuie să conțină cel puțin o poziție.");

  for (const line of input.lines) {
    const amounts = [
      line.quantity,
      line.unitPriceWithoutVat,
      line.totalWithoutVat,
      line.vatRate,
      line.totalVat,
      line.total,
    ];
    if (!line.name.trim() || amounts.some((value) => !Number.isFinite(value))) {
      throw new Error("Una dintre pozițiile facturii este incompletă.");
    }
    if (line.quantity <= 0 || line.total < 0 || line.totalWithoutVat < 0 || line.totalVat < 0) {
      throw new Error("Cantitățile și sumele facturii nu sunt valide.");
    }
  }
}

function party(tag: "Supplier" | "Buyer", value: EFacturaParty) {
  const account = value.bankAccount?.trim();
  const bank = account ? `<BankAccount Account="${attribute(account)}"/>` : "";
  return `<${tag} IDNO="${attribute(value.idno.trim())}">${bank}</${tag}>`;
}

function money(value: number) {
  return value.toFixed(2);
}

function quantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function rate(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function attribute(value: string) {
  return text(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function text(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

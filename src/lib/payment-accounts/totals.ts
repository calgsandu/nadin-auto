export type PaymentPriceLine = {
  quantity: number;
  unitPriceGross: number;
};

export type CalculatedPaymentLine = PaymentPriceLine & {
  unitPriceNet: number;
  net: number;
  vat: number;
  gross: number;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePaymentTotals(
  inputLines: PaymentPriceLine[],
  vatRate: number,
  vatPayer: boolean,
) {
  const lines: CalculatedPaymentLine[] = inputLines.map((line) => {
    const gross = roundMoney(line.quantity * line.unitPriceGross);
    const unitPriceNet = vatPayer
      ? roundMoney(line.unitPriceGross / (1 + vatRate))
      : roundMoney(line.unitPriceGross);
    const net = roundMoney(unitPriceNet * line.quantity);
    const vat = vatPayer ? roundMoney(gross - net) : 0;

    return {
      ...line,
      unitPriceGross: roundMoney(line.unitPriceGross),
      unitPriceNet,
      net,
      vat,
      gross,
    };
  });

  return {
    lines,
    net: roundMoney(lines.reduce((sum, line) => sum + line.net, 0)),
    vat: roundMoney(lines.reduce((sum, line) => sum + line.vat, 0)),
    gross: roundMoney(lines.reduce((sum, line) => sum + line.gross, 0)),
  };
}

const SMALL_MASCULINE = [
  "zero",
  "unu",
  "doi",
  "trei",
  "patru",
  "cinci",
  "șase",
  "șapte",
  "opt",
  "nouă",
  "zece",
  "unsprezece",
  "doisprezece",
  "treisprezece",
  "paisprezece",
  "cincisprezece",
  "șaisprezece",
  "șaptesprezece",
  "optsprezece",
  "nouăsprezece",
] as const;

const TENS = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"] as const;

function smallNumber(value: number, feminine: boolean): string {
  if (value === 1 && feminine) return "o";
  if (value === 2 && feminine) return "două";
  if (value < 20) return SMALL_MASCULINE[value];

  const tens = Math.floor(value / 10);
  const unit = value % 10;
  return unit === 0 ? TENS[tens] : `${TENS[tens]} și ${smallNumber(unit, feminine)}`;
}

function underThousand(value: number, feminine = false): string {
  if (value < 100) return smallNumber(value, feminine);

  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const prefix =
    hundreds === 1
      ? "o sută"
      : `${smallNumber(hundreds, true)} sute`;
  return rest === 0 ? prefix : `${prefix} ${smallNumber(rest, feminine)}`;
}

function integerToRomanianWords(value: number): string {
  if (value === 0) return "zero";

  const parts: string[] = [];
  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const units = value % 1_000;

  if (millions > 0) {
    if (millions === 1) parts.push("un milion");
    else parts.push(`${underThousand(millions)}${millions >= 20 ? " de" : ""} milioane`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("o mie");
    else parts.push(`${underThousand(thousands, true)}${thousands >= 20 ? " de" : ""} mii`);
  }

  if (units > 0) parts.push(underThousand(units));
  return parts.join(" ");
}

export function moneyToRomanianWords(value: number) {
  const roundedCents = Math.round((value + Number.EPSILON) * 100);
  const lei = Math.floor(roundedCents / 100);
  const bani = roundedCents % 100;
  const words = lei === 1 ? "un" : integerToRomanianWords(lei);
  const leiLabel = lei === 1 ? "leu" : "lei";
  const result = `${words} ${leiLabel} ${String(bani).padStart(2, "0")} bani`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

const KNOWN_BRANDS = new Set([
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CITROEN",
  "DACIA",
  "DAEWOO",
  "DODGE",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "KIA",
  "LAND ROVER",
  "MAZDA",
  "MB",
  "MERCEDES",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "RENAULT",
  "ROVER",
  "SEAT",
  "SKODA",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VOLVO",
  "VW",
]);

const BRAND_ALIASES: Record<string, string> = {
  MB: "MERCEDES-BENZ",
  MERCEDES: "MERCEDES-BENZ",
  VW: "VOLKSWAGEN",
};

const TYPE_PREFIXES: Array<[string, string]> = [
  ["prag++++arca", "Prag + arcă"],
  ["prag+++arca", "Prag + arcă"],
  ["prag", "Prag"],
  ["arca", "Arcă"],
  ["arcă", "Arcă"],
  ["aripa", "Aripă"],
  ["aripă", "Aripă"],
  ["carenaj", "Carenaj"],
  ["carenaje", "Carenaj"],
  ["panou", "Panou"],
  ["bara", "Bară"],
  ["bară", "Bară"],
  ["scara", "Scară"],
  ["scară", "Scară"],
  ["jgheab", "Jgheab"],
  ["jgheag", "Jgheab"],
  ["oglind", "Oglindă"],
  ["stop", "Stop"],
  ["semnalizator", "Semnalizator"],
  ["far", "Far"],
  ["etanș", "Etanșant"],
  ["etans", "Etanșant"],
  ["capot", "Capotă"],
  ["mecanizm", "Mecanism"],
  ["mecanism", "Mecanism"],
  ["diuz", "Duză"],
  ["mîiner", "Mâner"],
  ["mâner", "Mâner"],
  ["tapiterie", "Tapițerie"],
  ["tapițerie", "Tapițerie"],
];

export type ParsedVehicle = {
  brandName: string;
  modelName: string;
  fitmentLabel: string;
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
};

export type ParsedProductDescription = {
  typeName: string;
  notes: string | null;
  description: string;
};

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\n/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCode(value: unknown) {
  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

export function parseHeaderBrand(value: unknown) {
  return parseHeaderVehicles(value)[0]?.brandName ?? null;
}

export function parseVehicle(value: unknown, fallbackBrandName?: string | null): ParsedVehicle {
  const original = normalizeText(value);
  const yearMatch = findLastYearMatch(original);
  const base = stripYearSegments(
    yearMatch
      ? `${original.slice(0, yearMatch.index)} ${original.slice(yearMatch.index + yearMatch.raw.length)}`
      : original,
  );
  const tokens = base
    .replace(/--/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/^-\s*/, "")
    .split(" ")
    .filter(Boolean);

  let brandName = fallbackBrandName ? normalizeBrandName(fallbackBrandName) : null;
  let modelTokens = tokens;
  const knownBrand = findKnownBrand(tokens);

  if (knownBrand) {
    brandName = normalizeBrandName(knownBrand.name);
    modelTokens = tokens.slice(knownBrand.tokenCount);
  }

  const modelName = normalizeModelName(modelTokens.join(" ").trim() || original);

  return {
    brandName: brandName ?? "NECUNOSCUT",
    modelName,
    fitmentLabel: original,
    yearStart: yearMatch?.start ?? null,
    yearEnd: yearMatch?.end ?? null,
    yearOpenEnded: yearMatch?.openEnded ?? false,
  };
}

export function parseHeaderVehicles(value: unknown) {
  const original = normalizeText(value);
  const yearMatch = findLastYearMatch(original);
  const base = stripYearSegments(
    yearMatch ? original.slice(0, yearMatch.index).trim() : original,
    { keepSeparators: true },
  );
  const segments = splitVehicleSegments(base);
  const vehicles: ParsedVehicle[] = [];

  for (const segment of segments) {
    const vehicle = parseVehicle(segment, vehicles.at(-1)?.brandName ?? null);

    if (vehicle.brandName !== "NECUNOSCUT") {
      vehicles.push({
        ...vehicle,
        fitmentLabel: original,
        yearStart: yearMatch?.start ?? vehicle.yearStart,
        yearEnd: yearMatch?.end ?? vehicle.yearEnd,
        yearOpenEnded: yearMatch?.openEnded ?? vehicle.yearOpenEnded,
      });
    }
  }

  return vehicles;
}

export function parseVehicleApplications(
  value: unknown,
  headerVehicles: ParsedVehicle[] = [],
) {
  const original = normalizeText(value);
  const yearMatch = findLastYearMatch(original);
  const base = stripYearSegments(
    yearMatch
      ? `${original.slice(0, yearMatch.index)} ${original.slice(yearMatch.index + yearMatch.raw.length)}`
      : original,
  );
  const segments = splitVehicleSegments(base);

  if (segments.length <= 1 || headerVehicles.length <= 1) {
    const parsed = parseVehicle(original, headerVehicles[0]?.brandName ?? null);
    const header = headerVehicles[0];
    const parsedHasExplicitBrand = firstTokenIsKnownBrand(base);

    return [
      {
        ...parsed,
        brandName:
          parsedHasExplicitBrand || !header ? parsed.brandName : header.brandName,
        modelName:
          parsedHasExplicitBrand || !header ? parsed.modelName : header.modelName,
      },
    ];
  }

  return segments.map((segment, index) => {
    const parsed = parseVehicle(segment, headerVehicles[index]?.brandName ?? null);
    const matchedHeader =
      headerVehicles.find((header) => sameModel(header.modelName, parsed.modelName)) ??
      headerVehicles[index];

    return {
      ...parsed,
      brandName: matchedHeader?.brandName ?? parsed.brandName,
      modelName: matchedHeader?.modelName ?? parsed.modelName,
      fitmentLabel: `${matchedHeader?.brandName ?? parsed.brandName} ${matchedHeader?.modelName ?? parsed.modelName} ${formatYearLabel(yearMatch?.start ?? parsed.yearStart, yearMatch?.end ?? parsed.yearEnd, yearMatch?.openEnded ?? parsed.yearOpenEnded)}`.trim(),
      yearStart: yearMatch?.start ?? parsed.yearStart,
      yearEnd: yearMatch?.end ?? parsed.yearEnd,
      yearOpenEnded: yearMatch?.openEnded ?? parsed.yearOpenEnded,
    };
  });
}

export function parseProductDescription(value: unknown): ParsedProductDescription {
  const description = normalizeText(value);
  const lowerDescription = description.toLocaleLowerCase("ro");
  const typeName =
    TYPE_PREFIXES.find(([prefix]) => lowerDescription.startsWith(prefix))?.[1] ??
    titleCase(description.split(" ")[0] || "Altul");
  const notes = parseNotes(description);

  return {
    typeName,
    notes,
    description,
  };
}

function findLastYearMatch(value: string) {
  const matches = [...value.matchAll(/\/?\s*(\d{2,4})(?:\s*-\s*(\d{2,4})|\s*(\+))\s*\/?/g)];
  const match = matches.at(-1);

  if (!match || match.index === undefined) {
    return null;
  }

  return {
    raw: match[0],
    index: match.index,
    start: normalizeYear(match[1]),
    end: match[2] ? normalizeYear(match[2]) : null,
    openEnded: Boolean(match[3]),
  };
}

function normalizeYear(value: string) {
  const numeric = Number(value);

  if (value.length === 2) {
    return numeric >= 40 ? 1900 + numeric : 2000 + numeric;
  }

  return numeric;
}

function stripYearSegments(
  value: string,
  options: { keepSeparators?: boolean } = {},
) {
  return normalizeText(
    value.replace(
      /\/\s*\d{2,4}\s*(?:-\s*\d{2,4}|\+)\s*\/?/g,
      options.keepSeparators ? " / " : " ",
    ),
  );
}

function splitVehicleSegments(value: string) {
  const normalized = normalizeComparable(value);

  if (normalized === "VWPOLOHB") {
    return [value];
  }

  if (normalized === "VWLT3545") {
    return ["VW LT 35", "VW LT 45"];
  }

  return value.split("/").map(normalizeText).filter(Boolean);
}

function sameModel(left: string, right: string) {
  return normalizeComparable(left) === normalizeComparable(right);
}

function normalizeComparable(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
}

function firstTokenIsKnownBrand(value: string) {
  const tokens = value
    .replace(/--/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/^-\s*/, "")
    .split(" ")
    .filter(Boolean);

  return Boolean(findKnownBrand(tokens));
}

function findKnownBrand(tokens: string[]) {
  const twoWordBrand = tokens.slice(0, 2).join(" ").toUpperCase();

  if (KNOWN_BRANDS.has(twoWordBrand)) {
    return { name: twoWordBrand, tokenCount: 2 };
  }

  const oneWordBrand = tokens[0]?.toUpperCase();

  if (oneWordBrand && KNOWN_BRANDS.has(oneWordBrand)) {
    return { name: oneWordBrand, tokenCount: 1 };
  }

  return null;
}

function normalizeBrandName(value: string) {
  const upper = value.toUpperCase();
  return BRAND_ALIASES[upper] ?? upper;
}

function normalizeModelName(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+\/\s*$/g, "")
    .trim();
}

function formatYearLabel(
  yearStart: number | null | undefined,
  yearEnd: number | null | undefined,
  yearOpenEnded: boolean | undefined,
) {
  if (!yearStart && !yearEnd) {
    return "";
  }

  if (yearOpenEnded) {
    return `${yearStart}+`;
  }

  return [yearStart, yearEnd].filter(Boolean).join("-");
}

function parseNotes(description: string) {
  const notes = [...description.matchAll(/\/([^/]+)\//g)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean);

  return notes.length > 0 ? notes.join("; ") : null;
}

function titleCase(value: string) {
  const lower = value.toLocaleLowerCase("ro");
  return lower.charAt(0).toLocaleUpperCase("ro") + lower.slice(1);
}

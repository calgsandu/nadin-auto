export type CompatibilityInput = {
  id: string;
  brandName: string;
  modelName: string;
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
};

export type CompatibilityLine = {
  title: string;
  years: string;
};

export function buildCompatibilityLines(
  compatibilities: CompatibilityInput[],
): CompatibilityLine[] {
  const unique = new Map<string, CompatibilityInput>();

  for (const compatibility of compatibilities) {
    // Imported fitments and app-created fitments can share the same
    // brand/model/years under different labels — dedupe on what we display.
    unique.set(
      `${compatibility.brandName}|${compatibility.modelName}|${formatCompatibilityYears(compatibility)}`,
      compatibility,
    );
  }

  return [...unique.values()]
    .sort((left, right) =>
      `${left.brandName} ${left.modelName}`.localeCompare(
        `${right.brandName} ${right.modelName}`,
      ),
    )
    .map((compatibility) => ({
      title: `${compatibility.brandName} ${compatibility.modelName}`,
      years: formatCompatibilityYears(compatibility),
    }));
}

function formatCompatibilityYears(compatibility: CompatibilityInput) {
  if (compatibility.yearStart == null) return "—";
  if (compatibility.yearOpenEnded) return `${compatibility.yearStart}–prezent`;
  if (compatibility.yearEnd != null) return `${compatibility.yearStart}–${compatibility.yearEnd}`;

  return `din ${compatibility.yearStart}`;
}

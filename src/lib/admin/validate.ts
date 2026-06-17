export type Parsed<T> = { ok: true; data: T } | { ok: false; message: string };

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseYear(formData: FormData, key: string): Parsed<number | null> {
  const raw = str(formData, key);
  if (!raw) return { ok: true, data: null };
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1900 || value > 2100) {
    return { ok: false, message: "Anul trebuie să fie între 1900 și 2100." };
  }
  return { ok: true, data: value };
}

export function parseName(formData: FormData): Parsed<{ name: string }> {
  const name = str(formData, "name");
  if (!name) return { ok: false, message: "Numele este obligatoriu." };
  return { ok: true, data: { name } };
}

export function parseWarehouse(
  formData: FormData,
): Parsed<{ name: string; isDefault: boolean; active: boolean }> {
  const name = str(formData, "name");
  if (!name) return { ok: false, message: "Numele depozitului este obligatoriu." };
  return {
    ok: true,
    data: {
      name,
      isDefault: formData.get("isDefault") === "on",
      active: formData.get("active") === "on",
    },
  };
}

export function parseModel(
  formData: FormData,
): Parsed<{ brandId: string; name: string }> {
  const brandId = str(formData, "brandId");
  const name = str(formData, "name");
  if (!brandId) return { ok: false, message: "Alege brandul." };
  if (!name) return { ok: false, message: "Numele modelului este obligatoriu." };
  return { ok: true, data: { brandId, name } };
}

export function parseFitment(formData: FormData): Parsed<{
  carModelId: string;
  label: string;
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
}> {
  const carModelId = str(formData, "carModelId");
  const label = str(formData, "label");
  if (!carModelId) return { ok: false, message: "Alege modelul." };
  if (!label) return { ok: false, message: "Eticheta (ex. generația) este obligatorie." };

  const start = parseYear(formData, "yearStart");
  if (!start.ok) return start;
  const end = parseYear(formData, "yearEnd");
  if (!end.ok) return end;
  if (start.data && end.data && start.data > end.data) {
    return { ok: false, message: "Anul de început nu poate fi după anul de sfârșit." };
  }

  return {
    ok: true,
    data: {
      carModelId,
      label,
      yearStart: start.data,
      yearEnd: end.data,
      yearOpenEnded: formData.get("yearOpenEnded") === "on",
    },
  };
}

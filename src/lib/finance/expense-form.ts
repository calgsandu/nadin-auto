import type { ExpenseCategory } from "@/generated/prisma/enums";
import { isExpenseCategory } from "@/lib/finance/categories";

export type ExpenseInput = {
  date: Date;
  category: ExpenseCategory;
  amountLei: number;
  description: string;
  partnerId: string | null;
  accountId: string;
  notes: string | null;
};

export type ExpenseParseResult =
  | { ok: true; data: ExpenseInput }
  | { ok: false; message: string };

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseExpenseForm(formData: FormData): ExpenseParseResult {
  const description = readString(formData, "description");
  if (!description) return { ok: false, message: "Scrie pentru ce s-au dat banii." };

  const categoryRaw = readString(formData, "category");
  if (!isExpenseCategory(categoryRaw)) {
    return { ok: false, message: "Alege o categorie de cheltuială." };
  }

  const amountLei = Number(readString(formData, "amountLei").replace(",", "."));
  if (!Number.isFinite(amountLei) || amountLei <= 0) {
    return { ok: false, message: "Suma trebuie să fie mai mare decât zero." };
  }

  const accountId = readString(formData, "accountId");
  if (!accountId) return { ok: false, message: "Alege din ce cont s-a plătit." };

  // Ora fixată la prânz: la fusul Chișinăului o dată „la miezul nopții" cade
  // în ziua precedentă când e citită în UTC, iar cheltuiala ar sări luna.
  const dateRaw = readString(formData, "date");
  const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Data nu este validă." };

  return {
    ok: true,
    data: {
      date,
      category: categoryRaw,
      amountLei: Math.round(amountLei * 100) / 100,
      description,
      partnerId: readString(formData, "partnerId") || null,
      accountId,
      notes: readString(formData, "notes") || null,
    },
  };
}

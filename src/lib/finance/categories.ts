import type { ExpenseCategory } from "@/generated/prisma/enums";

/**
 * Categoriile de cheltuieli, în ordinea în care se cheltuiesc banii într-un
 * magazin de piese: mai întâi fixele lunare, la urmă „altele".
 */
export const EXPENSE_CATEGORIES: readonly { id: ExpenseCategory; label: string }[] = [
  { id: "CHIRIE", label: "Chirie" },
  { id: "SALARII", label: "Salarii" },
  { id: "UTILITATI", label: "Utilități" },
  { id: "COMBUSTIBIL", label: "Combustibil" },
  { id: "TRANSPORT", label: "Transport marfă" },
  { id: "AMBALAJE", label: "Ambalaje și consumabile" },
  { id: "COMISION_CARD", label: "Comision bancar și POS" },
  { id: "TAXE", label: "Taxe și impozite" },
  { id: "SERVICII", label: "Servicii (contabil, IT, reclamă)" },
  { id: "ALTELE", label: "Altele" },
];

const LABELS = new Map(EXPENSE_CATEGORIES.map((category) => [category.id, category.label]));

export function expenseCategoryLabel(category: ExpenseCategory) {
  return LABELS.get(category) ?? category;
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return LABELS.has(value as ExpenseCategory);
}

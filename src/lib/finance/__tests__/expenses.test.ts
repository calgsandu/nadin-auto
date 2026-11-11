import assert from "node:assert/strict";
import { parseExpenseForm } from "@/lib/finance/expense-form";
import { EXPENSE_CATEGORIES, expenseCategoryLabel, isExpenseCategory } from "@/lib/finance/categories";
import { monthBounds, monthLabel, recentMonths } from "@/lib/finance/months";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = {
  description: "Chiria pe septembrie",
  category: "CHIRIE",
  amountLei: "7500",
  accountId: "acc-1",
  date: "2026-09-01",
};

// Cazul bun: suma se rotunjește la bani, câmpurile goale devin null.
const parsed = parseExpenseForm(form(valid));
assert.ok(parsed.ok);
assert.equal(parsed.data.amountLei, 7500);
assert.equal(parsed.data.category, "CHIRIE");
assert.equal(parsed.data.partnerId, null);
assert.equal(parsed.data.notes, null);

// Ora fixată la prânz: data introdusă rămâne în ziua ei, nu alunecă în luna precedentă.
assert.equal(parsed.data.date.getDate(), 1);
assert.equal(parsed.data.date.getMonth(), 8);

const withComma = parseExpenseForm(form({ ...valid, amountLei: "1234,567" }));
assert.ok(withComma.ok);
assert.equal(withComma.data.amountLei, 1234.57);

for (const [field, value] of [
  ["description", ""],
  ["category", "CEVA"],
  ["amountLei", "0"],
  ["amountLei", "-10"],
  ["amountLei", "abc"],
  ["accountId", ""],
] as const) {
  const result = parseExpenseForm(form({ ...valid, [field]: value }));
  assert.equal(result.ok, false, `„${field}=${value}" trebuia respins`);
}

// Categoriile: eticheta există pentru fiecare, iar textul brut nu trece de gardă.
assert.equal(EXPENSE_CATEGORIES.length, 10);
assert.equal(expenseCategoryLabel("SALARII"), "Salarii");
assert.equal(isExpenseCategory("CHIRIE"), true);
assert.equal(isExpenseCategory("chirie"), false);

// Marginile lunii: început inclusiv, sfârșit exclusiv, cu trecerea peste an.
const december = monthBounds("2026-12");
assert.equal(december.key, "2026-12");
assert.equal(december.start.getFullYear(), 2026);
assert.equal(december.start.getMonth(), 11);
assert.equal(december.end.getFullYear(), 2027);
assert.equal(december.end.getMonth(), 0);
assert.equal(monthBounds("stricat").key, monthBounds(undefined).key);
assert.ok(monthLabel("2026-09").includes("2026"));

const months = recentMonths(3);
assert.equal(months.length, 3);
assert.equal(months[0].key, monthBounds(undefined).key);
assert.notEqual(months[0].key, months[1].key);

console.log("expenses tests passed");

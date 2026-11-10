import assert from "node:assert/strict";
import {
  mergeDocumentHeader,
  mergeDocumentLines,
  mergeLineFromDb,
  parseDocumentBase,
  type MergeLine,
} from "@/lib/operations/document-merge";

const line = (productId: string, quantity: number, price: number | null = null): MergeLine => ({
  productId,
  externalName: null,
  externalCode: null,
  externalSupplierId: null,
  externalCost: null,
  quantity,
  price,
});
const ids = (lines: MergeLine[]) => lines.map((l) => `${l.productId}:${l.quantity}`).sort();

// Cazul real din 2026-11-10: tab vechi (baza = A,B) schimbă doar B, iar între
// timp altcineva a adăugat C și D. Înainte, salvarea ștergea C și D.
{
  const base = [line("A", 1), line("B", 1)];
  const mine = [line("A", 1), line("B", 2)];
  const theirs = [line("A", 1), line("B", 1), line("C", 3), line("D", 1)];
  const result = mergeDocumentLines(base, mine, theirs);
  assert.deepEqual(ids(result.lines), ["A:1", "B:2", "C:3", "D:1"]);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.theirsChanged, true);
  // Rândurile noi ale celuilalt intră sus.
  assert.equal(result.lines[0].productId, "C");
}

// Fără nimic schimbat între timp = exact ce a trimis operatorul (inclusiv ștergeri).
{
  const base = [line("A", 1), line("B", 1)];
  const mine = [line("B", 5), line("E", 1)];
  const result = mergeDocumentLines(base, mine, base);
  assert.deepEqual(ids(result.lines), ["B:5", "E:1"]);
  assert.equal(result.theirsChanged, false);
  assert.equal(result.conflicts.length, 0);
}

// Celălalt a șters o linie pe care operatorul n-a atins-o → rămâne ștearsă.
{
  const base = [line("A", 1), line("B", 1)];
  const result = mergeDocumentLines(base, [line("A", 1), line("B", 1)], [line("A", 1)]);
  assert.deepEqual(ids(result.lines), ["A:1"]);
}

// Operatorul șterge o linie pe care celălalt n-a atins-o → dispare.
{
  const base = [line("A", 1), line("B", 1)];
  const theirs = [line("A", 1), line("B", 1), line("C", 2)];
  const result = mergeDocumentLines(base, [line("A", 1)], theirs);
  assert.deepEqual(ids(result.lines), ["A:1", "C:2"]);
}

// Amândoi schimbă aceeași linie diferit → câștigă operatorul, linia e raportată.
{
  const base = [line("A", 1)];
  const result = mergeDocumentLines(base, [line("A", 4)], [line("A", 2)], (l) => `cod ${l.productId}`);
  assert.deepEqual(ids(result.lines), ["A:4"]);
  assert.deepEqual(result.conflicts, [{ key: "A", label: "cod A" }]);
}

// Amândoi adaugă același produs cu aceeași cantitate → fără conflict, o singură linie.
{
  const result = mergeDocumentLines([], [line("A", 2)], [line("A", 2)]);
  assert.deepEqual(ids(result.lines), ["A:2"]);
  assert.equal(result.conflicts.length, 0);
}

// Prețul contează la comparație (recepții, vânzări).
{
  const base = [line("A", 1, 100)];
  const result = mergeDocumentLines(base, [line("A", 1, 100)], [line("A", 1, 120)]);
  assert.equal(result.lines[0].price, 120, "operatorul n-a atins prețul → rămâne cel nou din DB");
}

// Liniile externe: cheie pe nume + cod, nu pe productId gol.
{
  const ext = (name: string, quantity: number): MergeLine => ({
    ...line("", quantity),
    productId: null,
    externalName: name,
    externalCode: "X1",
  });
  const base = [ext("Bară", 1)];
  const result = mergeDocumentLines(base, [ext("Bară", 1)], [ext("Bară", 1), ext("Far", 2)]);
  assert.deepEqual(result.lines.map((l) => l.externalName).sort(), ["Bară", "Far"]);
}

// Antetul: operatorul schimbă notițele, celălalt data → se păstrează amândouă.
{
  const base = { documentDate: "2026-08-07", notes: "Inventar", warehouseId: "w1", partnerId: "", partnerName: "" };
  const merged = mergeDocumentHeader(
    base,
    { ...base, notes: "Inventar pavilion" },
    { ...base, documentDate: "2026-11-10" },
  );
  assert.equal(merged.header.notes, "Inventar pavilion");
  assert.equal(merged.header.documentDate, "2026-11-10");
  assert.equal(merged.theirsChanged, true);
}

// Baza venită de la client: aceleași reguli ca formularul, inventarul fără preț.
{
  const parsed = parseDocumentBase(
    JSON.stringify({
      lines: [
        { productId: "A", quantity: "-2", price: "15" },
        { productId: "", quantity: "1", price: "", externalName: "Far", externalCost: "7,5" },
        { productId: "", quantity: "1", price: "" },
      ],
      documentDate: "2026-08-07",
      notes: " Inventar ",
      warehouseId: "w1",
      partnerId: "",
      partnerName: "",
    }),
    false,
  );
  assert.ok(parsed);
  assert.equal(parsed.lines.length, 2, "rândul gol nu e linie");
  assert.equal(parsed.lines[0].quantity, -2);
  assert.equal(parsed.lines[0].price, null);
  assert.equal(parsed.lines[1].externalCost, 7.5);
  assert.equal(parsed.header.notes, "Inventar");
  assert.equal(parseDocumentBase("nu e json", true), null);
  assert.equal(parseDocumentBase(JSON.stringify({ notes: "x" }), true), null);
}

// O linie din DB și aceeași linie din baza clientului au aceeași semnătură.
{
  const db = mergeLineFromDb(
    {
      productId: "A",
      externalName: null,
      externalCode: null,
      externalSupplierId: null,
      quantity: 3,
      unitPriceEuro: null,
      unitCostLei: { toString: () => "120.5" },
    },
    "RECEIPT",
  );
  const client = parseDocumentBase(
    JSON.stringify({ lines: [{ productId: "A", quantity: "3", price: "120.5" }] }),
    true,
  );
  assert.ok(client);
  const result = mergeDocumentLines(client.lines, client.lines, [db]);
  assert.equal(result.theirsChanged, false);
}

console.log("document merge tests passed");

import assert from "node:assert/strict";
import { groupBySupplier } from "@/lib/operations/reorder";
import { viberPhone } from "@/app/crm/_components/copy-message";

const polcar = { id: "s1", name: "Polcar", phone: "069123456" };
const groups = groupBySupplier([
  { id: "a", sold: 1, stock: 2, supplier: polcar },
  { id: "b", sold: 3, stock: 0, supplier: null },
  { id: "c", sold: 2, stock: 0, supplier: polcar },
]);

// Furnizorul cunoscut primul, „fără furnizor" la coadă; în grup, stocul cel mai mic primul.
assert.deepEqual(groups.map((group) => group.supplier?.name ?? null), ["Polcar", null]);
assert.deepEqual(groups[0].items.map((item) => item.id), ["c", "a"]);

assert.equal(viberPhone("069 123 456"), "+37369123456");
assert.equal(viberPhone("+373 69 123 456"), "+37369123456");
assert.equal(viberPhone("0037369123456"), "+37369123456");
assert.equal(viberPhone("69123456"), "+37369123456");
assert.equal(viberPhone("123"), null);

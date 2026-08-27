import assert from "node:assert/strict";
import {
  buildStickerItems,
  countStickers,
  matchesLineFilter,
} from "@/lib/operations/stickers";

const lines = [
  { productId: "p1", sticker: true, copies: "3" },
  { productId: "p2", sticker: false, copies: "9" },
  { productId: "p3", sticker: true, copies: "" },
  // linie externă: n-are produs, deci n-are etichetă
  { productId: "", sticker: true, copies: "5" },
];

assert.equal(countStickers(lines), 3);
// copii goale = o etichetă la print, nu zero
assert.equal(buildStickerItems(lines), "p1:3,p3:1");
assert.equal(buildStickerItems([{ productId: "p1", sticker: false, copies: "2" }]), "");

// Filtrul lasă mereu vizibil rândul încă necompletat.
assert.equal(matchesLineFilter("", { productId: "p1", label: "Prag" }), true);
assert.equal(matchesLineFilter("prag", { productId: "p1", label: "PRAG ușă" }), true);
assert.equal(matchesLineFilter("bara", { productId: "p1", label: "Prag ușă" }), false);
assert.equal(matchesLineFilter("bara", { productId: "", label: "" }), true);

// Diacriticele nu mai contează în niciun sens: „Panou usa" găsea zero rânduri.
assert.equal(matchesLineFilter("Panou usa", { productId: "p1", label: "Panou ușă spate" }), true);
assert.equal(matchesLineFilter("panou ușă", { productId: "p1", label: "Panou usa spate" }), true);

// Ordinea cuvintelor e liberă; fiecare termen trebuie să apară undeva.
assert.equal(matchesLineFilter("usa panou", { productId: "p1", label: "Panou ușă spate" }), true);
assert.equal(matchesLineFilter("panou bara", { productId: "p1", label: "Panou ușă spate" }), false);

// Anul din interval, nu doar capetele scrise în etichetă.
const bmw = { productId: "p1", label: "P129 · BMW E46 1998–2006 · Arcă · Arca aripă" };
assert.equal(matchesLineFilter("2005", bmw), true);
assert.equal(matchesLineFilter("1998", bmw), true);
assert.equal(matchesLineFilter("2010", bmw), false);
assert.equal(matchesLineFilter("bmw 2005", bmw), true);

// „–prezent" = fără capăt de sus.
const vito = { productId: "p2", label: "MERCEDES-BENZ VITO 2003–prezent · Prag" };
assert.equal(matchesLineFilter("2024", vito), true);
assert.equal(matchesLineFilter("1999", vito), false);

// A treia formă scrisă de `formatYears`: fitment fără an de sfârșit.
const sprinter = { productId: "p3", label: "MB SPRINTER din 2018 · Aripă" };
assert.equal(matchesLineFilter("2020", sprinter), true);
assert.equal(matchesLineFilter("2018", sprinter), true);
assert.equal(matchesLineFilter("2017", sprinter), false);

console.log("sticker tests passed");

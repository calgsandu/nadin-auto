import assert from "node:assert/strict";
import { parseTransferLines } from "@/lib/operations/transfer-lines";

assert.deepEqual(
  parseTransferLines({
    productIds: ["product-a", "product-b"],
    quantities: ["3", "2"],
  }),
  [
    { productId: "product-a", quantity: 3 },
    { productId: "product-b", quantity: 2 },
  ],
);

assert.throws(
  () => parseTransferLines({ productIds: [], quantities: [] }),
  /Adaugă cel puțin un produs în transfer/,
);

assert.throws(
  () => parseTransferLines({ productIds: ["product-a"], quantities: ["0"] }),
  /Cantitatea de pe poziția 1 trebuie să fie mai mare decât zero/,
);

assert.throws(
  () =>
    parseTransferLines({
      productIds: ["product-a", "product-a"],
      quantities: ["1", "2"],
    }),
  /Produsul de pe poziția 2 este adăugat de mai multe ori/,
);

// Rândul adăugat dar lăsat fără produs se scoate singur, nu blochează salvarea.
assert.deepEqual(
  parseTransferLines({
    productIds: ["product-a", ""],
    quantities: ["1", ""],
  }),
  [{ productId: "product-a", quantity: 1 }],
);
assert.throws(
  () => parseTransferLines({ productIds: [""], quantities: [""] }),
  /Adaugă cel puțin un produs în transfer/,
);

console.log("transfer lines tests passed");

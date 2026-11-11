import assert from "node:assert/strict";
import { canon, fixTypos, stripMarkers } from "@/lib/catalog/pricelist-text";

// markerele furnizorului dispar din descriere, dar semnalează piesa locală
assert.deepEqual(stripMarkers("Arca față / local / ZZZ 1L"), {
  desc: "Arca față 1L",
  isLocal: true,
});
assert.deepEqual(stripMarkers("Prag ușă față L"), { desc: "Prag ușă față L", isLocal: false });

// LOCAL_RE e global: apelurile repetate nu trebuie să alterneze rezultatul
assert.equal(stripMarkers("Panou lateral / local / 1L").isLocal, true);
assert.equal(stripMarkers("Panou lateral / local / 1L").isLocal, true);

// canon ignoră spațiile și liniuțele — de aceea „P22802 1" și „P22802-1" se ciocnesc
assert.equal(canon("P22802 1"), canon("P22802-1"));
assert.equal(canon("Prag 4/5uși R"), "PRAG45UȘIR");

assert.equal(fixTypos("Panou stîlp central L"), "Panou stâlp central L");
assert.equal(fixTypos("Mîiner interior ușă față L"), "Mâner interior ușă față L");
assert.equal(fixTypos("Aripa față L"), "Aripă față L");

console.log("pricelist text tests passed");

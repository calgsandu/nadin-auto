import assert from "node:assert/strict";
import {
  getSection,
  navigationEntries,
  resolveSection,
  workspaceSections,
} from "@/lib/operations/workspace";

assert.equal(resolveSection(undefined), "produse");
assert.equal(resolveSection("sectiune-inexistenta"), "produse");
assert.equal(resolveSection("depozite"), "depozite");

const expectedSections = [
  "produse",
  "receptii",
  "transferuri",
  "vanzari",
  "conturi-plata",
  "retururi",
  "de-adus",
  "fara-stoc",
  "inventar",
  "depozite",
  "furnizori",
  "personal",
  "branduri",
  "modele",
  "tipuri",
  "compatibilitati",
  "documente",
  "istoric",
  "rapoarte",
  "statistici",
];

assert.deepEqual(
  workspaceSections.map((section) => section.id),
  expectedSections,
  "Workspace-ul trebuie să conțină produsele, operațiunile, furnizorii și personalul.",
);

assert.deepEqual(
  navigationEntries.map((entry) => entry.section),
  expectedSections,
  "Sidebar-ul trebuie să conțină operațiunile, furnizorii și personalul.",
);

assert.equal(getSection("produse").title, "Produse");
assert.equal(getSection("receptii").title, "Recepții marfă");
assert.equal(getSection("transferuri").title, "Transferuri între depozite");
assert.equal(getSection("vanzari").title, "Vânzări");
assert.equal(getSection("conturi-plata").title, "Conturi de plată");
assert.equal(getSection("retururi").title, "Retururi");
assert.equal(getSection("statistici").title, "Statistici");
assert.equal(getSection("de-adus").title, "De adus în 110A");
assert.equal(getSection("fara-stoc").title, "Fără stoc 110A");
assert.equal(getSection("depozite").title, "Depozite");
assert.equal(getSection("furnizori").title, "Parteneri");
assert.equal(getSection("personal").title, "Personal");
assert.equal(resolveSection("furnizori"), "furnizori");
assert.equal(resolveSection("personal"), "personal");

assert.equal(
  navigationEntries.find((entry) => entry.section === "personal")?.adminOnly,
  true,
  "Intrarea Personal trebuie marcată adminOnly.",
);

assert.ok(
  navigationEntries.every((entry) => entry.icon),
  "Fiecare intrare din sidebar trebuie să aibă icon.",
);

console.log("workspace tests passed");

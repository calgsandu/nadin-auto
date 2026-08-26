import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
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
  "la-comanda",
  "conturi-plata",
  "clienti",
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
  "aprobari",
  "istoric",
  "rapoarte",
  "statistici",
  "inchidere-zi",
  "tva",
  "preturi",
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
assert.equal(getSection("clienti").title, "Clienți");
assert.equal(getSection("retururi").title, "Retururi");
assert.equal(getSection("statistici").title, "Statistici");
assert.equal(getSection("de-adus").title, "De adus în 110A");
assert.equal(getSection("fara-stoc").title, "Fără stoc 110A");
assert.equal(getSection("depozite").title, "Depozite");
assert.equal(getSection("furnizori").title, "Furnizori");
assert.equal(getSection("personal").title, "Personal");
assert.equal(getSection("inchidere-zi").title, "Închidere de zi");
assert.equal(getSection("tva").title, "Registrul TVA");
assert.equal(getSection("preturi").title, "Istoric prețuri");
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

// Fiecare secțiune trebuie să aibă ruta ei sub /crm — altfel nav-ul duce în 404.
const routes = readdirSync("src/app/crm", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(
  routes,
  [...expectedSections].sort(),
  "Secțiunile din nav și folderele de rute trebuie să coincidă.",
);

// Fiecare rută are și un schelet de încărcare, ca trecerea între tab-uri să nu
// arate un ecran înghețat cât timp se citește din bază.
for (const route of routes) {
  assert.ok(
    existsSync(`src/app/crm/${route}/loading.tsx`),
    `Ruta /crm/${route} trebuie să aibă loading.tsx.`,
  );
}

console.log("workspace tests passed");

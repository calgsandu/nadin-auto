import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

/** Formularele de operațiuni: fără `<form action>` = fără resetul automat al React. */
const DIALOGS = [
  "src/app/operations/stock-document-dialog.tsx",
  "src/app/operations/inventory-dialog.tsx",
  "src/app/operations/return-dialog.tsx",
  "src/app/operations/document-row-actions.tsx",
  "src/app/payment-accounts/payment-account-dialog.tsx",
  "src/app/partners/payment-dialog.tsx",
  "src/app/partners/partner-form-dialog.tsx",
  "src/app/catalog/product-form-dialog.tsx",
  "src/app/external-orders/external-order-dialog.tsx",
  "src/app/admin/admin-dialogs.tsx",
];

for (const file of DIALOGS) {
  const source = read(file);
  assert.match(source, /useDrawerAction\(/, `${file}: trimiterea trece prin useDrawerAction`);
  // `<form action>` ar goli câmpurile la eroare; formularele de drawer trimit manual.
  // (Formularele de ștergere din aceleași fișiere n-au ce pierde și rămân pe `action`.)
  assert.match(source, /onSubmit=\{onSubmit\}/, `${file}: formularul trebuie trimis prin onSubmit`);
  // Panoul rămâne montat după închidere (ciorna se păstrează). Excepție:
  // return-dialog ține TOT în state-ul componentei părinte, deci ciorna
  // supraviețuiește oricum închiderii.
  if (!file.endsWith("return-dialog.tsx")) {
    assert.match(source, /mounted \?|!mounted/, `${file}: panoul trebuie ținut montat după prima deschidere`);
  }
}

// Ciorna în localStorage: fiecare dialog de operațiune o ține, ca refreshul,
// crashul de tab sau navigarea prin sidebar să nu piardă documentul început.
const DRAFT_DIALOGS = [
  "src/app/operations/stock-document-dialog.tsx",
  "src/app/operations/inventory-dialog.tsx",
  "src/app/operations/return-dialog.tsx",
  "src/app/operations/document-row-actions.tsx",
  "src/app/payment-accounts/payment-account-dialog.tsx",
  "src/app/partners/payment-dialog.tsx",
];

for (const file of DRAFT_DIALOGS) {
  const source = read(file);
  assert.match(source, /useDrawerDraft\(/, `${file}: ciorna trebuie ținută prin useDrawerDraft`);
  assert.match(source, /ref=\{attachForm\}/, `${file}: formularul trebuie legat de ciornă`);
  assert.match(source, /draft\.clear\(\)/, `${file}: salvarea reușită trebuie să șteargă ciorna`);
  // Ciorna recuperată trebuie să refacă și produsul ales pe rând, nu doar
  // cifrele. Încasarea și returul n-au căutare de produs (returul își ia
  // rândurile din vânzarea aleasă).
  if (!file.endsWith("payment-dialog.tsx") && !file.endsWith("return-dialog.tsx")) {
    assert.match(source, /initialProduct=\{/, `${file}: produsul de pe rând trebuie refăcut din ciornă`);
  }
}

// Cheia de idempotență: aceeași ciornă retrimisă nu poate crea două documente.
// Editarea documentului nu are nevoie (reversare + reaplicare dă aceeași stare).
for (const file of DRAFT_DIALOGS.filter((f) => !f.endsWith("document-row-actions.tsx"))) {
  assert.match(
    read(file),
    /name="idempotencyKey" type="hidden" value=\{draft\.token\}/,
    `${file}: trimiterea trebuie să poarte cheia de idempotență`,
  );
}

// Serverul verifică token-ul ÎNAINTE de a atinge stocul și îl scrie pe document.
for (const file of [
  "src/app/operations/actions.ts",
  "src/app/partners/actions.ts",
  "src/app/payment-accounts/actions.ts",
]) {
  const source = read(file);
  assert.match(source, /readToken\(formData\)/, `${file}: acțiunea trebuie să citească token-ul`);
  assert.match(source, /idempotencyKey: token/, `${file}: token-ul trebuie scris pe document`);
  assert.match(
    source,
    /isDuplicateKeyError\(error\)/,
    `${file}: trimiterea paralelă respinsă de baza de date înseamnă „salvat deja"`,
  );
}

// Etichetele și căutarea peste rândurile adăugate trebuie să fie în AMBELE
// dialoguri de inventar: cel de creare și cel de editare a documentului.
for (const file of [
  "src/app/operations/inventory-dialog.tsx",
  "src/app/operations/document-row-actions.tsx",
]) {
  const source = read(file);
  assert.match(source, /<AddedLinesFilter/, `${file}: lipsește căutarea în cele adăugate`);
  assert.match(source, /<StickerPrintButton/, `${file}: lipsește butonul de etichete`);
  assert.match(source, /<LabelStickerCell/, `${file}: lipsește bifa de etichetă pe rând`);
  assert.match(source, /matchesLineFilter\(filter, line\)/, `${file}: filtrul nu ascunde rândurile`);
}

// Un produs deja pus pe o linie nu mai apare în căutarea celorlalte linii.
for (const file of [
  "src/app/operations/inventory-dialog.tsx",
  "src/app/operations/document-row-actions.tsx",
  "src/app/operations/stock-document-dialog.tsx",
]) {
  assert.match(
    read(file),
    /excludedProductIds=\{/,
    `${file}: produsele deja adăugate trebuie excluse din căutare`,
  );
}

const combobox = read("src/app/operations/product-search-combobox.tsx");
// Lista de rezultate stă într-un portal: drawerul cu overflow-y-auto o tăia.
assert.match(combobox, /createPortal\(/, "lista de rezultate trebuie randată în portal");
assert.match(combobox, /placeDropdown\(rect, window\.innerHeight\)/, "poziția vine din placeDropdown");
// Produsul ales se citește ca fișă (etichetele lungi nu mai sunt tăiate în input).
assert.match(combobox, /function ProductCard\(/, "produsul ales trebuie afișat ca fișă");
assert.match(combobox, /onDoubleClick=\{onEdit\}/, "dublu-click readuce câmpul de căutare");
// Editarea pornește de la cod, iar ieșirea fără modificare păstrează produsul.
assert.match(combobox, /setQuery\(productCode\(/, "editarea trebuie să pornească de la cod");
assert.match(combobox, /cancelEditing\(\);/, "ieșirea fără modificare readuce fișa");

// Rezultatele căutării vin în ordinea scorului de relevanță, nu alfabetic.
const searchRoute = read("src/app/api/products/search/route.ts");
assert.match(searchRoute, /matchedIds\s*\n?\s*\.map\(\(id\)/, "ruta trebuie să păstreze ordinea din scor");
assert.match(
  read("src/lib/catalog/product-match.ts"),
  /ORDER BY score DESC/,
  "potrivirile trebuie ordonate după scor",
);

const drawer = read("src/app/components/operation-drawer.tsx");
assert.match(drawer, /DrawerPortal locked=\{open\}/, "panoul ascuns nu blochează scrollul paginii");
assert.match(drawer, /beforeunload/, "ciorna nesalvată avertizează la refresh/închidere de tab");
assert.match(drawer, /formRef\.current\?\.reset\(\)/, "formularul se golește doar la salvare reușită");
// Rețeaua căzută nu aruncă în afară: devine mesaj cu „Reîncearcă", care
// retrimite ACELAȘI FormData (deci același token) — fără risc de dublare.
assert.match(drawer, /navigator\.onLine === false/, "submitul fără conexiune nu pleacă deloc");
assert.match(drawer, /lastFormData\.current/, "reîncercarea trimite exact același FormData");
assert.match(drawer, /Reîncearcă/, "mesajul de eroare de transport are buton de reîncercare");

const portal = read("src/app/components/drawer-portal.tsx");
assert.match(portal, /locked = true/, "DrawerPortal trebuie să accepte blocarea condiționată");

console.log("drawer drafts test passed");

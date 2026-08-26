import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

/**
 * Crearea unui produs din INTERIORUL altui dialog (recepție, vânzare, inventar...):
 * lanțul ține doar dacă acțiunea întoarce produsul, iar comboboxul îl pune
 * înapoi pe rândul din care s-a plecat. Rupi o verigă și operatorul rămâne cu
 * produsul creat, dar cu rândul tot gol.
 */
const actions = read("src/app/catalog/actions.ts");
assert.match(
  actions,
  /created\?: ProductSearchResult;/,
  "CatalogActionState trebuie să poarte produsul creat",
);
assert.match(
  actions,
  /created: await productSearchResult\(createdId\)/,
  "createProductAction trebuie să întoarcă produsul creat",
);
// Aceeași formă pe care o consumă deja căutarea — nu una construită de mână.
assert.match(actions, /toProductSearchResult\(product\)/, "produsul întors trece prin toProductSearchResult");
assert.match(actions, /include: productLabelInclude/, "eticheta cere tipul + toate compatibilitățile");

// Dreptul de creare vine de la server, o dată cu rezultatele: fără el butonul
// ar fi apărut și pentru ANGAJAT, care n-are drept de scriere în catalog.
const searchRoute = read("src/app/api/products/search/route.ts");
assert.match(searchRoute, /const canCreate = canWriteCatalog\(user\.role\);/, "ruta de căutare decide dreptul");
assert.match(searchRoute, /products: \[\], canCreate/, "răspunsul gol poartă și el dreptul");

const formOptions = read("src/app/api/catalog/form-options/route.ts");
assert.match(formOptions, /getCurrentAppUser\(\)/, "ruta de opțiuni cere utilizatorul");
assert.match(formOptions, /!canWriteCatalog\(user\.role\)/, "ruta de opțiuni respinge rolurile fără drept");

const combobox = read("src/app/operations/product-search-combobox.tsx");
assert.match(combobox, /setCanCreate\(data\.canCreate \?\? false\)/, "comboboxul citește dreptul din răspuns");
assert.match(
  combobox,
  /canCreate && formOptions \?/,
  "butonul apare doar cu drept de scriere și cu opțiunile încărcate",
);
// „Adaugă produs" înseamnă deja „adaugă un rând" în inventar: eticheta de aici
// trebuie să spună explicit unde intră piesa, cu textul căutat în ea.
assert.match(
  combobox,
  /Adaugă „\{query\.trim\(\)\}” în catalog/,
  "butonul nu are voie să repete formularea din inventar",
);
assert.match(combobox, /onCreated=\{selectProduct\}/, "produsul creat se întoarce selectat pe rând");
assert.match(
  combobox,
  /initialDescription=\{query\.trim\(\)\}/,
  "descrierea pornește de la ce s-a tastat în căutare",
);

// Formularul deschis din alt dialog: fără buton propriu, cu părintele ascuns.
const dialog = read("src/app/catalog/product-form-dialog.tsx");
assert.match(dialog, /useDrawerStackChild\(open\)/, "părintele se ascunde cât timp formularul e deschis");
assert.match(dialog, /\{controlled \? null : \(/, "în mod controlat dialogul nu-și randează butonul");
assert.match(dialog, /drawerBoundaryProps/, "evenimentele nu au voie să urce în formularul părinte");
assert.match(dialog, /if \(saved\.created\) onCreated\?\.\(saved\.created\);/, "produsul creat pleacă spre apelant");

/**
 * Furnizorul și lanțul brand → model → compatibilitate: aceeași regulă, alte
 * entități. Verificarea e pe sursă fiindcă legătura e între fișiere — o acțiune
 * care nu mai întoarce `created` lasă selectul gol fără să pice nimic altceva.
 */
const partners = read("src/app/partners/actions.ts");
assert.match(partners, /created\?: \{[\s\S]*?id: string;[\s\S]*?name: string;/, "PartnerActionState poartă partenerul creat");
assert.match(
  partners,
  /created: \{[\s\S]*?id: created\.id,[\s\S]*?name: created\.name,/,
  "createPartnerAction trebuie să întoarcă partenerul creat",
);

const admin = read("src/app/admin/actions.ts");
assert.match(admin, /function done\(message: string, created\?/, "done\\(\\) trebuie să poată purta entitatea creată");
for (const [entity, call] of [
  ["brandul", /done\("Brand adăugat\.", \{ id: brand\.id, name: brand\.name \}\)/],
  ["modelul", /done\("Model adăugat\.", \{[\s\S]*?\}\)/],
  ["tipul", /done\("Tip de produs adăugat\.", \{ id: type\.id, name: type\.name \}\)/],
  ["compatibilitatea", /done\("Compatibilitate adăugată\.", \{ id: fitment\.id, name: fitment\.label \}\)/],
] as const) {
  assert.match(admin, call, `acțiunea de creare trebuie să întoarcă ${entity}`);
}
// Eticheta modelului e „<marcă> <model>" — exact forma din lista de compatibilități.
assert.match(admin, /name: `\$\{model\.brand\.name\} \$\{model\.name\}`/, "modelul se întoarce cu marca în etichetă");

// Selectul de furnizor nu mai are voie să fie o fundătură: cu lista goală era
// DEZACTIVAT, deci din ecranul acela nu exista nicio ieșire.
const supplierPicker = read("src/app/partners/supplier-picker.tsx");
assert.match(supplierPicker, /Furnizor nou/, "selectul de furnizor are ieșire spre formularul de partener");
assert.match(supplierPicker, /defaultKind="SUPPLIER"/, "tipul vine preselectat");
for (const file of [
  "src/app/operations/stock-document-dialog.tsx",
  "src/app/operations/document-row-actions.tsx",
  "src/app/external-orders/external-order-dialog.tsx",
]) {
  const source = read(file);
  assert.match(source, /<SupplierPicker/, `${file}: selectul de furnizor trebuie să treacă prin SupplierPicker`);
  assert.doesNotMatch(
    source,
    /disabled=\{suppliers\.length === 0\}/,
    `${file}: selectul de furnizor nu mai are voie să fie dezactivat`,
  );
}

// Opțiunea nouă intră optimist: `revalidatePath` sosește după ce selectul a
// primit deja valoarea, iar rândul ar rămâne gol exact când te uiți la el.
for (const file of [
  "src/app/partners/supplier-picker.tsx",
  "src/app/admin/admin-dialogs.tsx",
  "src/app/operations/stock-document-dialog.tsx",
]) {
  assert.match(read(file), /useOptimisticOptions\(/, `${file}: opțiunea creată trebuie adăugată optimist`);
}

const adminDialogs = read("src/app/admin/admin-dialogs.tsx");
assert.match(adminDialogs, /<BrandSelect/, "dialogul de model deschide dialogul de brand");
assert.match(adminDialogs, /<ModelSelect/, "dialogul de compatibilitate deschide dialogul de model");
assert.match(adminDialogs, /useDrawerStackChild\(open\)/, "panoul-părinte se ascunde sub cel copil");
assert.match(adminDialogs, /drawerBoundaryProps/, "evenimentele nu urcă în formularul părinte");

// „Alte compatibilități" nu mai e limitată la ce există deja.
const productForm = read("src/app/catalog/product-form-dialog.tsx");
assert.match(productForm, /<BrandSelect/, "rândul de compatibilitate poate crea brandul");
assert.match(productForm, /<ModelSelect/, "rândul de compatibilitate poate crea modelul");
assert.doesNotMatch(productForm, /Doar branduri și modele existente/, "textul vechi nu mai e adevărat");

// Editarea unei recepții primea lista de furnizori goală, deși existau.
assert.match(
  read("src/app/crm/documente/page.tsx"),
  /suppliers=\{suppliers\}/,
  "editarea documentului trebuie să primească furnizorii",
);

// „Client nou" deschide direct fișa de partener: varianta veche scria doar
// numele, iar clientul rămânea fără IDNO/adresă și bloca mai târziu contul de plată.
const sale = read("src/app/operations/stock-document-dialog.tsx");
assert.doesNotMatch(sale, /newCustomerName/, "vânzarea nu mai creează clienți doar cu numele");
assert.match(sale, /onClick=\{\(\) => setCustomerForm\(true\)\}/, "butonul Client nou deschide fișa de partener");
assert.match(sale, /selectCustomer\(partner\.id, partner\.discountPercent\)/, "clientul creat se alege cu tot cu discount");

const paymentAccount = read("src/app/payment-accounts/payment-account-dialog.tsx");
assert.doesNotMatch(paymentAccount, /newCustomerName/, "contul de plată nu mai are input liber de client");
assert.match(paymentAccount, /<PartnerFormDialog/, "butonul Client nou din contul de plată deschide fișa de partener");

console.log("inline create chain test passed");

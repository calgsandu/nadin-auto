import assert from "node:assert/strict";
import { lockBodyScroll } from "@/app/components/drawer-portal";

const body = { style: { overflow: "auto" } };

// Un singur panou: blochează și pune la loc exact ce era înainte.
const single = lockBodyScroll(body);
assert.equal(body.style.overflow, "hidden");
single();
assert.equal(body.style.overflow, "auto");

// Două panouri deodată (dialog-copil peste părinte): închiderea celui de-al
// doilea NU are voie să redea scrollul cât timp primul e încă pe ecran, iar
// „valoarea de dinainte" rămâne cea de la prima blocare, nu „hidden".
const parent = lockBodyScroll(body);
const child = lockBodyScroll(body);
assert.equal(body.style.overflow, "hidden");
child();
assert.equal(body.style.overflow, "hidden", "părintele e încă deschis");
parent();
assert.equal(body.style.overflow, "auto", "ultimul panou închis redă scrollul");

// Eliberarea chemată de două ori nu strică contorul (ar debloca pagina sub un
// panou încă deschis).
const first = lockBodyScroll(body);
const second = lockBodyScroll(body);
first();
first();
assert.equal(body.style.overflow, "hidden", "a doua eliberare a aceluiași panou se ignoră");
second();
assert.equal(body.style.overflow, "auto");

console.log("drawer scroll lock test passed");

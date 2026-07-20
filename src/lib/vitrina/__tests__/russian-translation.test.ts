import assert from "node:assert/strict";
import {
  russianProductType,
  translateCatalogText,
} from "@/lib/vitrina/russian-translation";

assert.equal(russianProductType("Prag"), "Порог");
assert.equal(russianProductType("Semnalizator"), "Указатель поворота");
assert.equal(russianProductType("Tip necunoscut"), "Tip necunoscut");

assert.equal(
  translateCatalogText("Prag 4/5uși / grosime 1mm / L"),
  "Порог 4/5 дверей / толщина 1 мм / L",
);
assert.equal(
  translateCatalogText("Arca aripă spate 4/5uși R"),
  "Ремонтная арка заднего крыла 4/5 дверей R",
);
assert.equal(
  translateCatalogText("element reparație cu partea interioară"),
  "ремонтный элемент с внутренней частью",
);
assert.equal(translateCatalogText("model BOSCH"), "модель BOSCH");
assert.equal(translateCatalogText("Prag 5uși L"), "Порог 5 дверей L");
assert.equal(translateCatalogText("2buc pentru 2roți"), "2 шт. для 2 колеса");
assert.equal(translateCatalogText("Braț pîn la 25cm"), "Рычаг до 25 см");
assert.equal(translateCatalogText("clîc fixare"), "клипса крепление");

console.log("russian catalog translation tests passed");

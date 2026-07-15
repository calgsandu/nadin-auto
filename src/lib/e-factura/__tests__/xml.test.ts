import assert from "node:assert/strict";
import { buildEFacturaXml } from "@/lib/e-factura/xml";

const xml = buildEFacturaXml({
  deliveryDate: new Date("2026-07-14T12:00:00.000Z"),
  reference: "payment-account:account-1",
  supplier: {
    idno: "1017600020085",
    bankAccount: "MD59AG000000022513141479",
  },
  buyer: {
    idno: "1006600052073",
    bankAccount: "MD17MO2224ASV48168667100",
  },
  lines: [
    {
      code: "A&B\"1",
      name: "Prag stânga <VW> & Caddy",
      unitOfMeasure: "buc.",
      quantity: 2,
      unitPriceWithoutVat: 1041.67,
      totalWithoutVat: 2083.34,
      vatRate: 20,
      totalVat: 416.66,
      total: 2500,
    },
  ],
});

assert.match(xml, /^<\?xml version="1\.0" encoding="utf-8"\?>/);
assert.match(xml, /<Documents><Document><SupplierInfo>/);
assert.match(xml, /<DeliveryDate>2026-07-14T12:00:00\.000Z<\/DeliveryDate>/);
assert.match(xml, /<Supplier IDNO="1017600020085"><BankAccount Account="MD59AG000000022513141479"\/><\/Supplier>/);
assert.match(xml, /<Buyer IDNO="1006600052073"><BankAccount Account="MD17MO2224ASV48168667100"\/><\/Buyer>/);
assert.match(xml, /Code="A&amp;B&quot;1"/);
assert.match(xml, /Name="Prag stânga &lt;VW&gt; &amp; Caddy"/);
assert.match(xml, /UnitPriceWithoutTVA="1041\.67"/);
assert.match(xml, /TotalPriceWithoutTVA="2083\.34"/);
assert.match(xml, /TVA="20" TotalTVA="416\.66" TotalPrice="2500\.00"/);
assert.match(xml, /<AdditionalInformation><id>payment-account:account-1<\/id><\/AdditionalInformation>/);

assert.throws(
  () => buildEFacturaXml({
    deliveryDate: new Date("2026-07-14T12:00:00.000Z"),
    reference: "invalid",
    supplier: { idno: "", bankAccount: "" },
    buyer: { idno: "100", bankAccount: null },
    lines: [],
  }),
  /IDNO-ul furnizorului/,
);

console.log("e-Factura XML tests passed");

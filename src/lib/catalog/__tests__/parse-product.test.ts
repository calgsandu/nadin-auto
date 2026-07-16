import assert from "node:assert/strict";
import {
  parseHeaderVehicles,
  parseVehicleApplications,
} from "@/lib/catalog/parse-product";

const headerVehicles = parseHeaderVehicles(
  "CHEVROLET LACETTI / DAEWOO  NUBIRA   03-09",
);
const applications = parseVehicleApplications(
  "LACETTI / NUBIRA   /03-09/",
  headerVehicles,
);

assert.deepEqual(
  applications.map((application) => ({
    brandName: application.brandName,
    modelName: application.modelName,
    yearStart: application.yearStart,
    yearEnd: application.yearEnd,
  })),
  [
    {
      brandName: "CHEVROLET",
      modelName: "LACETTI",
      yearStart: 2003,
      yearEnd: 2009,
    },
    {
      brandName: "DAEWOO",
      modelName: "NUBIRA",
      yearStart: 2003,
      yearEnd: 2009,
    },
  ],
);

const citroenHeader = parseHeaderVehicles("CITROEN   XSARA PICASSO  99-12");
const singleApplication = parseVehicleApplications(
  "XSARA  PICASSO  /99-12/",
  citroenHeader,
);

assert.equal(singleApplication.length, 1);
assert.equal(singleApplication[0].brandName, "CITROEN");
assert.equal(singleApplication[0].modelName, "XSARA PICASSO");

const avensisHeader = parseHeaderVehicles("TOYOTA   AVENSIS    (T-25)   03-08");
const avensisApplication = parseVehicleApplications(
  "AVENSIS   / T-25 /   /03-08/",
  avensisHeader,
);

assert.equal(avensisApplication.length, 1);
assert.equal(avensisApplication[0].brandName, "TOYOTA");
assert.equal(avensisApplication[0].modelName, "AVENSIS (T-25)");

const mercedesHeader = parseHeaderVehicles("MB  VITO/VIANO  03-14");
assert.equal(mercedesHeader[0].brandName, "MERCEDES-BENZ");

const mercedesRexVarioHeader = parseHeaderVehicles(
  "MB  REX   /84-98/   VARIO   /98-13/",
);
const mercedesRexVario = parseVehicleApplications(
  "MB  REX/VARIO  /84-13/",
  mercedesRexVarioHeader,
);

assert.deepEqual(
  mercedesRexVario.map((application) => application.modelName),
  ["REX", "VARIO"],
);

const mercedesBus = parseVehicleApplications("MB BUS 207-410 /77-95/");
assert.equal(mercedesBus[0].brandName, "MERCEDES-BENZ");
assert.equal(mercedesBus[0].modelName, "BUS 207-410");

const mercedesDelfinOpenEnded = parseVehicleApplications("MB DELFIN /06-18/ /18+");
assert.equal(mercedesDelfinOpenEnded[0].brandName, "MERCEDES-BENZ");
assert.equal(mercedesDelfinOpenEnded[0].modelName, "DELFIN");
assert.equal(mercedesDelfinOpenEnded[0].yearStart, 2018);
assert.equal(mercedesDelfinOpenEnded[0].yearOpenEnded, true);

const staleAudiHeader = parseHeaderVehicles("AUDI - 100 (44)  82-90");
const explicitBmwApplication = parseVehicleApplications(
  "BMW E 34  /88-96/",
  staleAudiHeader,
);

assert.equal(explicitBmwApplication[0].brandName, "BMW");
assert.equal(explicitBmwApplication[0].modelName, "E 34");

const landRover = parseVehicleApplications("LAND ROVER FREELANDER /99-06/");
assert.equal(landRover[0].brandName, "LAND ROVER");
assert.equal(landRover[0].modelName, "FREELANDER");

const poloHeader = parseHeaderVehicles("VW POLO H/B 94-99");
const poloHatchback = parseVehicleApplications("VW POLO H/B /94-99/", poloHeader);
assert.equal(poloHatchback.length, 1);
assert.equal(poloHatchback[0].brandName, "VOLKSWAGEN");
assert.equal(poloHatchback[0].modelName, "POLO H/B");

const ltHeader = parseHeaderVehicles("VW LT 35/45 95-06");
const ltApplications = parseVehicleApplications("VW LT-35/45 /95-06/", ltHeader);
assert.deepEqual(
  ltApplications.map((application) => application.modelName),
  ["LT 35", "LT 45"],
);

console.log("parse-product tests passed");

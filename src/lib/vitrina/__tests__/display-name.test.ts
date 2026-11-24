import assert from "node:assert/strict";
import { displayName } from "@/lib/vitrina/display-name";

const cases: [string, string][] = [
  ["MERCEDES-BENZ", "Mercedes-Benz"],
  ["VOLKSWAGEN", "Volkswagen"],
  ["BMW", "BMW"],
  ["DUCATO- II", "Ducato II"],
  ["GOLF- IV", "Golf IV"],
  ["GOLF- V PLUS", "Golf V Plus"],
  ["KA -I", "Ka I"],
  ["MEGANE-II", "Megane-II"],
  ["VITO W639", "Vito W639"],
  ["T-4", "T-4"],
  ["COROLLA E-12", "Corolla E-12"],
  ["AVENSIS (T-25)", "Avensis (T-25)"],
  ["CRV-1", "CRV-1"],
  ["HR-V", "HR-V"],
  ["RAV-4", "RAV-4"],
  ["C-3", "C-3"],
  ["XSARA PICASSO", "Xsara Picasso"],
  ["CRUISER-100", "Cruiser-100"],
  ["ML W163", "ML W163"],
  ["BUS 207-410", "Bus 207-410"],
  ["Golf", "Golf"],
];
for (const [input, expected] of cases) assert.equal(displayName(input), expected, input);

console.log("display-name tests passed");

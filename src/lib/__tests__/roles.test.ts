import assert from "node:assert/strict";
import {
  canCreateSales,
  canManageStaff,
  canViewSection,
  canWriteCatalog,
  wouldDeleteLastAdmin,
  wouldDeactivateLastAdmin,
  wouldRemoveLastAdmin,
} from "@/lib/roles";

// canWriteCatalog: ADMIN + DIRECTOR write, ANGAJAT does not.
assert.equal(canWriteCatalog("ADMIN"), true);
assert.equal(canWriteCatalog("DIRECTOR"), true);
assert.equal(canWriteCatalog("ANGAJAT"), false);
assert.equal(canWriteCatalog(null), false);

// canManageStaff: only ADMIN.
assert.equal(canManageStaff("ADMIN"), true);
assert.equal(canManageStaff("DIRECTOR"), false);
assert.equal(canManageStaff("ANGAJAT"), false);
assert.equal(canManageStaff(undefined), false);

// wouldRemoveLastAdmin: block demoting the only admin.
const oneAdmin = [
  { id: "a", role: "ADMIN" as const },
  { id: "b", role: "ANGAJAT" as const },
];
assert.equal(
  wouldRemoveLastAdmin(oneAdmin, "a", "DIRECTOR"),
  true,
  "Nu se poate retrograda singurul admin.",
);
assert.equal(
  wouldRemoveLastAdmin(oneAdmin, "a", "ADMIN"),
  false,
  "Păstrarea rolului ADMIN este permisă.",
);
assert.equal(
  wouldRemoveLastAdmin(oneAdmin, "b", "DIRECTOR"),
  false,
  "Promovarea altui utilizator nu afectează adminul existent.",
);

// With two admins, demoting one is fine.
const twoAdmins = [
  { id: "a", role: "ADMIN" as const },
  { id: "b", role: "ADMIN" as const },
];
assert.equal(wouldRemoveLastAdmin(twoAdmins, "a", "ANGAJAT"), false);

// wouldDeleteLastAdmin: block deleting the only admin.
assert.equal(
  wouldDeleteLastAdmin(oneAdmin, "a"),
  true,
  "Nu se poate șterge singurul admin.",
);
assert.equal(
  wouldDeleteLastAdmin(oneAdmin, "b"),
  false,
  "Ștergerea unui non-admin nu afectează adminul existent.",
);
assert.equal(
  wouldDeleteLastAdmin(twoAdmins, "a"),
  false,
  "Cu doi admini, unul poate fi șters.",
);

assert.equal(
  wouldDeactivateLastAdmin(
    [{ id: "a", role: "ADMIN" as const, active: true }],
    "a",
  ),
  true,
  "Singurul administrator activ nu poate fi dezactivat.",
);
assert.equal(
  wouldDeactivateLastAdmin(
    [
      { id: "a", role: "ADMIN" as const, active: true },
      { id: "b", role: "ADMIN" as const, active: false },
    ],
    "a",
  ),
  true,
  "Un administrator deja dezactivat nu protejează accesul.",
);
assert.equal(
  wouldDeactivateLastAdmin(
    [
      { id: "a", role: "ADMIN" as const, active: true },
      { id: "b", role: "ADMIN" as const, active: true },
    ],
    "a",
  ),
  false,
  "Cu doi administratori activi, unul poate fi dezactivat.",
);

// canCreateSales: toate rolurile autentificate pot vinde.
assert.equal(canCreateSales("ANGAJAT"), true);
assert.equal(canCreateSales("ADMIN"), true);
assert.equal(canCreateSales(null), false);

// canViewSection: ANGAJAT vede doar produse + vânzări.
assert.equal(canViewSection("ANGAJAT", "produse"), true);
assert.equal(canViewSection("ANGAJAT", "vanzari"), true);
assert.equal(canViewSection("ANGAJAT", "conturi-plata"), true);
assert.equal(canViewSection("ANGAJAT", "receptii"), false);
assert.equal(canViewSection("ANGAJAT", "statistici"), false);
assert.equal(canViewSection("ANGAJAT", "istoric"), false);
// Istoric: doar ADMIN/DIRECTOR; Personal: doar ADMIN.
assert.equal(canViewSection("DIRECTOR", "istoric"), true);
assert.equal(canViewSection("ADMIN", "istoric"), true);
assert.equal(canViewSection("DIRECTOR", "personal"), false);
assert.equal(canViewSection("ADMIN", "personal"), true);
assert.equal(canViewSection(null, "produse"), false);

console.log("roles tests passed");

import assert from "node:assert/strict";
import { MOVEMENT_KINDS, isMovementKind, movementKindLabel, movementSign } from "@/lib/finance/movements";

// Semnul: doar depunerile și încasările bagă bani în cont.
assert.equal(movementSign("DEPUNERE"), 1);
assert.equal(movementSign("ALTA_INCASARE"), 1);
assert.equal(movementSign("RETRAGERE"), -1);
assert.equal(movementSign("ALTA_PLATA"), -1);
// Transferul pleacă din contul ales; celălalt capăt se scrie cu semnul opus.
assert.equal(movementSign("TRANSFER"), -1);

assert.equal(MOVEMENT_KINDS.length, 5);
assert.ok(MOVEMENT_KINDS.every((kind) => kind.label && kind.hint));
assert.equal(movementKindLabel("TRANSFER"), "Transfer între conturi");
assert.equal(isMovementKind("DEPUNERE"), true);
assert.equal(isMovementKind("ORICE"), false);

console.log("movements tests passed");

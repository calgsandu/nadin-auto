import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedBreakGlassConfirmation,
  parseBreakGlassArgs,
} from "@/lib/staff/break-glass";

test("parses only the documented break-glass arguments", () => {
  assert.deepEqual(
    parseBreakGlassArgs([
      "--username",
      "ion",
      "--reason",
      "telefon pierdut",
    ]),
    { username: "ion", reason: "telefon pierdut" },
  );
  assert.deepEqual(parseBreakGlassArgs(["--help"]), { help: true });
  assert.throws(() => parseBreakGlassArgs(["--username", "ion"]), /reason/i);
  assert.throws(
    () =>
      parseBreakGlassArgs([
        "--username",
        "ion",
        "--reason",
        "x",
        "--force",
      ]),
    /--force/,
  );
});

test("requires an exact target-specific interactive confirmation", () => {
  assert.equal(expectedBreakGlassConfirmation("ion"), "RESET ion");
});

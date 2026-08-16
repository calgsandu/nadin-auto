import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

// Un singur font pentru tot proiectul, încărcat o dată în layoutul rădăcină.
assert.match(root, /Manrope\(\{[\s\S]*?variable:\s*"--font-app"/);

// Fonturile „by default" ale generatoarelor sunt interzise (vezi memoria de design).
function grep(pattern: string) {
  try {
    return execFileSync(
      "grep",
      ["-rn", "--include=*.tsx", "--include=*.css", "-E", pattern, "src", "--exclude-dir=generated"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

assert.equal(grep("Geist|JetBrains_Mono|Space_Grotesk|Inter\\("), "", "font interzis în src/");
// Micro-labelul de slop = text minuscul + UPPERCASE (inputurile de cod OTP au text-base, sunt OK).
assert.equal(grep("text-(xs|\\[1[01]px\\]).*uppercase"), "", "micro-label uppercase");

console.log("font + design-guard test passed");

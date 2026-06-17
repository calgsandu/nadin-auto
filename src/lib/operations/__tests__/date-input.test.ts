import assert from "node:assert/strict";
import { formatDateInputValue } from "@/lib/operations/date-input";

assert.equal(
  formatDateInputValue(new Date(2026, 5, 18, 2, 34)),
  "2026-06-18",
  "Date inputs must use the local calendar day, not UTC.",
);

assert.equal(formatDateInputValue(new Date(2026, 0, 5, 9, 0)), "2026-01-05");

console.log("date input tests passed");

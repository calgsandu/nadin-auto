import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLabelPrintQuery,
  hydrateLabelSelection,
  parseLabelSelection,
  serializeLabelSelection,
  setLabelCount,
  toggleLabelSelection,
} from "../label-selection";

test("parses stored selection items and clamps their counts", () => {
  assert.deepEqual(
    parseLabelSelection(
      '[{"id":"p1","code":"A","name":"Aripă","count":70}]',
    ),
    [{ id: "p1", code: "A", name: "Aripă", count: 50 }],
  );
});

test("migrates legacy id arrays with one copy", () => {
  assert.deepEqual(parseLabelSelection('["p1","p2"]'), [
    { id: "p1", code: "", name: "", count: 1 },
    { id: "p2", code: "", name: "", count: 1 },
  ]);
});

test("ignores invalid storage entries", () => {
  assert.deepEqual(parseLabelSelection("not-json"), []);
  assert.deepEqual(parseLabelSelection('{"id":"p1"}'), []);
  assert.deepEqual(parseLabelSelection('[null,42,{"name":"fără id"}]'), []);
});

test("deduplicates stored products and keeps the latest data", () => {
  assert.deepEqual(
    parseLabelSelection(
      '[{"id":"p1","code":"A","name":"Aripă","count":2},{"id":"p1","code":"B","name":"Bară","count":3}]',
    ),
    [{ id: "p1", code: "B", name: "Bară", count: 3 }],
  );
});

test("updates one quantity without changing selection order", () => {
  const items = [
    { id: "p1", code: "A", name: "Aripă", count: 1 },
    { id: "p2", code: "B", name: "Bară", count: 2 },
  ];

  assert.deepEqual(setLabelCount(items, "p1", 3), [
    { ...items[0], count: 3 },
    items[1],
  ]);
  assert.equal(setLabelCount(items, "p1", 0)[0]?.count, 1);
  assert.equal(setLabelCount(items, "p1", 90)[0]?.count, 50);
});

test("serializes selection and builds the print query", () => {
  const items = [
    { id: "p1", code: "A", name: "Aripă", count: 3 },
    { id: "p2", code: "B", name: "Bară", count: 1 },
  ];

  assert.deepEqual(parseLabelSelection(serializeLabelSelection(items)), items);
  assert.equal(buildLabelPrintQuery(items).get("items"), "p1:3,p2:1");
  assert.equal(buildLabelPrintQuery(items).get("layout"), "grid");
});

test("adds and removes a product while preserving its count", () => {
  const first = { id: "p1", code: "A", name: "Aripă", count: 4 };
  const second = { id: "p2", code: "B", name: "Bară", count: 1 };

  assert.deepEqual(toggleLabelSelection([first], second, true), [first, second]);
  assert.deepEqual(
    toggleLabelSelection([first], { ...first, name: "Aripă față", count: 1 }, true),
    [{ ...first, name: "Aripă față" }],
  );
  assert.deepEqual(toggleLabelSelection([first, second], first, false), [second]);
});

test("hydrates legacy product metadata from visible rows", () => {
  const stored = [{ id: "p1", code: "", name: "", count: 3 }];
  const visible = [{ id: "p1", code: "A", name: "Aripă", count: 1 }];

  assert.deepEqual(hydrateLabelSelection(stored, visible), [
    { id: "p1", code: "A", name: "Aripă", count: 3 },
  ]);
  assert.equal(hydrateLabelSelection(visible, visible), visible);
});

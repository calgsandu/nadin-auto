import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLabelPrintQuery,
  hydrateLabelSelection,
  parseLabelSelection,
  serializeLabelSelection,
  setLabelAlternativeCode,
  setLabelCount,
  toggleLabelSelection,
} from "../label-selection";

test("parses stored selection items and clamps their counts", () => {
  assert.deepEqual(
    parseLabelSelection(
      '[{"id":"p1","code":"A","name":"Aripă","count":70}]',
    ),
    [{
      id: "p1",
      code: "A",
      alternativeCode: "",
      name: "Aripă",
      compatibility: "",
      count: 50,
      includeAlternativeCode: false,
    }],
  );
});

test("migrates legacy id arrays with one copy", () => {
  assert.deepEqual(parseLabelSelection('["p1","p2"]'), [
    { id: "p1", code: "", alternativeCode: "", name: "", compatibility: "", count: 1, includeAlternativeCode: false },
    { id: "p2", code: "", alternativeCode: "", name: "", compatibility: "", count: 1, includeAlternativeCode: false },
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
    [{ id: "p1", code: "B", alternativeCode: "", name: "Bară", compatibility: "", count: 3, includeAlternativeCode: false }],
  );
});

test("updates one quantity without changing selection order", () => {
  const items = [
    { id: "p1", code: "A", alternativeCode: "", name: "Aripă", compatibility: "", count: 1, includeAlternativeCode: false },
    { id: "p2", code: "B", alternativeCode: "", name: "Bară", compatibility: "", count: 2, includeAlternativeCode: false },
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
    { id: "p1", code: "A", alternativeCode: "", name: "Aripă", compatibility: "", count: 3, includeAlternativeCode: false },
    { id: "p2", code: "B", alternativeCode: "", name: "Bară", compatibility: "", count: 1, includeAlternativeCode: false },
  ];

  assert.deepEqual(parseLabelSelection(serializeLabelSelection(items)), items);
  assert.equal(buildLabelPrintQuery(items).get("items"), "p1:3,p2:1");
  assert.equal(buildLabelPrintQuery(items).get("layout"), "grid");
});

test("adds and removes a product while preserving its count", () => {
  const first = { id: "p1", code: "A", alternativeCode: "", name: "Aripă", compatibility: "", count: 4, includeAlternativeCode: false };
  const second = { id: "p2", code: "B", alternativeCode: "", name: "Bară", compatibility: "", count: 1, includeAlternativeCode: false };

  assert.deepEqual(toggleLabelSelection([first], second, true), [first, second]);
  assert.deepEqual(
    toggleLabelSelection([first], { ...first, name: "Aripă față", count: 1 }, true),
    [{ ...first, name: "Aripă față" }],
  );
  assert.deepEqual(toggleLabelSelection([first, second], first, false), [second]);
});

test("hydrates legacy product metadata from visible rows", () => {
  const stored = [{ id: "p1", code: "", alternativeCode: "", name: "", compatibility: "", count: 3, includeAlternativeCode: false }];
  const visible = [{ id: "p1", code: "A", alternativeCode: "SUP-A", name: "Aripă", compatibility: "", count: 1, includeAlternativeCode: false }];

  assert.deepEqual(hydrateLabelSelection(stored, visible), [
    { id: "p1", code: "A", alternativeCode: "SUP-A", name: "Aripă", compatibility: "", count: 3, includeAlternativeCode: false },
  ]);
  assert.equal(hydrateLabelSelection(visible, visible), visible);
});

test("stores compatibility details for the compact label selector", () => {
  const compatibility = "AUDI A4 · Ani 1994–2000";
  assert.deepEqual(
    parseLabelSelection(
      `[{"id":"p1","code":"A","name":"Prag","compatibility":"${compatibility}","count":2}]`,
    ),
    [{ id: "p1", code: "A", alternativeCode: "", name: "Prag", compatibility, count: 2, includeAlternativeCode: false }],
  );

  assert.deepEqual(
    hydrateLabelSelection(
      [{ id: "p1", code: "A", alternativeCode: "", name: "Prag", compatibility: "", count: 2, includeAlternativeCode: false }],
      [{ id: "p1", code: "A", alternativeCode: "", name: "Prag", compatibility, count: 1, includeAlternativeCode: false }],
    ),
    [{ id: "p1", code: "A", alternativeCode: "", name: "Prag", compatibility, count: 2, includeAlternativeCode: false }],
  );
});

test("enables the alternative code only for products that have one", () => {
  const withAlternative = {
    id: "p1",
    code: "A",
    alternativeCode: "SUP-A",
    name: "Aripă",
    compatibility: "",
    count: 1,
    includeAlternativeCode: false,
  };

  assert.equal(
    setLabelAlternativeCode([withAlternative], "p1", true)[0]
      ?.includeAlternativeCode,
    true,
  );
  assert.equal(
    setLabelAlternativeCode(
      [{ ...withAlternative, alternativeCode: "" }],
      "p1",
      true,
    )[0]?.includeAlternativeCode,
    false,
  );
});

test("prints alternative codes only for explicitly enabled products", () => {
  const items = [
    {
      id: "p1",
      code: "A",
      alternativeCode: "SUP-A",
      name: "Aripă",
      compatibility: "",
      count: 2,
      includeAlternativeCode: true,
    },
    {
      id: "p2",
      code: "B",
      alternativeCode: "SUP-B",
      name: "Bară",
      compatibility: "",
      count: 1,
      includeAlternativeCode: false,
    },
  ];

  assert.equal(buildLabelPrintQuery(items).get("items"), "p1:2,p2:1");
  assert.equal(buildLabelPrintQuery(items).get("alt"), "p1");
  assert.equal(
    buildLabelPrintQuery(
      items.map((item) => ({ ...item, includeAlternativeCode: false })),
    ).has("alt"),
    false,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  attachRecords,
  changedKeys,
  coerceCell,
  fromServerLine,
  isLineDirty,
  isLineEmpty,
  linesFromTable,
  linesToSave,
  mergeServerLines,
  newLine,
  parseTable,
  recordLine,
  sameCell,
  stableStringify,
  toIsoDate,
} from "../src/pages/KpiIntake/intakeUtils.js";

const columns = [
  { key: "kpi_name", label: "KPI name", type: "text" },
  { key: "frequency", label: "Frequency", type: "enum", options: [{ value: "By Weekly", label: "BI Weekly" }, { value: "Monthly", label: "Monthly" }] },
  { key: "plant_id", label: "Plant", type: "ref", ref: "plant" },
  { key: "target_start_date", label: "Start date", type: "date" },
  { key: "kfs", label: "KPI / KFS", type: "enum", defaultValue: "KPI", options: [{ value: "KPI", label: "KPI" }, { value: "KFS", label: "KFS" }] },
];
const plants = [
  { id: 27, label: "Kunshan" },
  { id: 40, label: "Finance — Kunshan" },
];
const optionsFor = (column) => (column.ref === "plant" ? plants : []);

test("cells copied from Excel are read with tabs, line breaks and quotes", () => {
  assert.deepEqual(parseTable("a\tb\r\nc\td\r\n"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parseTable('"two\nlines"\t"say ""hi"""\n'), [["two\nlines", 'say "hi"']]);
  assert.deepEqual(parseTable("\n\t\n"), [], "blank rows are dropped");
});

test("a pasted value is understood the way the grid holds it", () => {
  assert.equal(coerceCell(columns[1], "bi weekly"), "By Weekly", "an option by its label, any case");
  assert.equal(coerceCell(columns[1], "Hourly"), "Hourly", "unknown: kept for the server to report");
  assert.equal(toIsoDate("31/03/2026"), "2026-03-31");
  assert.equal(toIsoDate("31/02/2026"), null);
  assert.equal(coerceCell(columns[3], "5.4.2026"), "2026-04-05");
  assert.deepEqual(coerceCell(columns[2], "kunshan", plants), { id: 27, label: "Kunshan" }, "an exact label is the record");
  assert.deepEqual(coerceCell(columns[2], "Finance – Kunshan", plants), { id: 40, label: "Finance — Kunshan" });
  assert.equal(coerceCell(columns[2], "Finance", plants), "Finance", "not exact: the server matches it");
});

test("pasted rows go by column title when there is one, else in grid order", () => {
  const byTitle = linesFromTable(parseTable("Plant\tkpi_name\tNotes\nKunshan\tScrap rate\tx\n"), columns, { optionsFor });
  assert.equal(byTitle.byHeader, true);
  assert.deepEqual(byTitle.ignoredHeaders, ["Notes"]);
  assert.deepEqual(byTitle.lines, [{ plant_id: { id: 27, label: "Kunshan" }, kpi_name: "Scrap rate" }]);

  const byOrder = linesFromTable(parseTable("Scrap rate\tMonthly\nYield\t\tChennai\n"), columns, { optionsFor });
  assert.equal(byOrder.byHeader, false);
  assert.deepEqual(byOrder.lines, [{ kpi_name: "Scrap rate", frequency: "Monthly" }, { kpi_name: "Yield", plant_id: "Chennai" }]);
});

test("only new lines with content and edited lines are saved", () => {
  const empty = newLine(columns);
  assert.equal(empty.values.kfs, "KPI", "defaults are pre-filled");
  assert.equal(isLineEmpty(empty, columns), true, "defaults alone are not content");

  const typed = { ...newLine(columns), values: { kfs: "KPI", kpi_name: "Yield" } };
  const saved = fromServerLine({ intake_id: 7, row_version: 2, status: "pending", values: { kpi_name: "Scrap rate", plant_id: { id: 27, label: "Kunshan" } } });
  assert.equal(isLineDirty(saved), false);
  const sameButReordered = { ...saved, values: { plant_id: { label: "Kunshan", id: 27 }, kpi_name: "Scrap rate", frequency: "" } };
  assert.equal(isLineDirty(sameButReordered), false, "key order and emptied cells do not count as edits");
  const edited = { ...saved, values: { ...saved.values, kpi_name: "Scrap" } };

  assert.deepEqual(linesToSave([empty, typed, saved, edited], columns), [typed, edited]);
  assert.equal(stableStringify({ b: 1, a: "" }), '{"b":1}');
});

test("fresh lines from the server never overwrite the cells being edited", () => {
  const editing = { ...fromServerLine({ intake_id: 1, row_version: 1, status: "pending", values: { kpi_name: "A" } }), values: { kpi_name: "A2" } };
  const untouched = fromServerLine({ intake_id: 2, row_version: 1, status: "pending", values: { kpi_name: "B" } });
  const gone = fromServerLine({ intake_id: 3, row_version: 1, status: "pending", values: { kpi_name: "C" } });
  const unsaved = newLine(columns);

  const merged = mergeServerLines(
    [editing, untouched, gone, unsaved],
    [
      { intake_id: 1, row_version: 2, status: "error", errors: { kpi_name: "x" }, values: { kpi_name: "A (other)" } },
      { intake_id: 2, row_version: 3, status: "duplicate", values: { kpi_name: "B (other)" } },
    ]
  );

  assert.deepEqual(merged.map((line) => line.key), [editing.key, "intake-2", unsaved.key], "a line deleted elsewhere disappears");
  assert.equal(merged[0].values.kpi_name, "A2", "edits kept");
  assert.equal(merged[0].row_version, 1, "the version loaded is kept, so the server can detect the conflict");
  assert.equal(merged[0].status, "error", "with the new check result");
  assert.equal(merged[1].values.kpi_name, "B (other)", "an untouched line takes the server's version");
});

// --- Rows of the database (signed-in users) -----------------------------------

const rowColumns = [
  { key: "kpi_name", label: "KPI name", type: "text" },
  { key: "target_value", label: "Target", type: "number" },
  { key: "unit", label: "Unit", type: "text" },
  { key: "plant_id", label: "Plant", type: "ref", ref: "plant" },
];
const scrapRow = { record_id: 12, values: { kpi_name: "Scrap rate", target_value: "10", unit: "%", plant_id: { id: 27, label: "Kunshan" } } };

test("cells compare as the server compares them", () => {
  const [, target, , plant] = rowColumns;
  assert.equal(sameCell(target, "12,50", "12.5"), true, "numbers by value");
  assert.equal(sameCell(plant, { id: 27, label: "Kunshan" }, { id: 27, label: "renamed" }), true, "references by record");
  assert.equal(sameCell(plant, "", null), true);
  assert.equal(sameCell(target, "", "0"), false, "empty is not zero");
  assert.deepEqual(changedKeys(rowColumns, { ...scrapRow.values, unit: " % " }, scrapRow.values), [], "spaces do not count");
});

test("a row of the database becomes a line to save only once a cell differs", () => {
  const untouched = recordLine(scrapRow);
  assert.equal(untouched.status, "record");
  assert.equal(isLineDirty(untouched), false);
  const edited = { ...untouched, values: { ...untouched.values, target_value: "12" } };
  const reverted = { ...untouched, values: { ...untouched.values, target_value: "10.0" } };
  assert.deepEqual(linesToSave([untouched, edited, reverted], rowColumns), [edited]);
});

test("a change is put on the row as it is now; a cell changed on both sides is a conflict", () => {
  // Saved when the target was 10 and the unit %; meanwhile the database has 11 and EA.
  const saved = fromServerLine({
    intake_id: 5,
    row_version: 1,
    status: "pending",
    record_id: 12,
    base: scrapRow.values,
    values: { ...scrapRow.values, target_value: "12" },
  });
  assert.equal(saved.key, "record-12", "keyed by the row");
  const now = { ...scrapRow, values: { ...scrapRow.values, target_value: "11", unit: "EA" } };

  const [rebased] = attachRecords([saved], [now], rowColumns);
  assert.equal(rebased.values.unit, "EA", "a cell the line does not change shows the database");
  assert.equal(rebased.values.target_value, "12", "the person's value is kept");
  assert.deepEqual(rebased.base, now.values, "saved again, it is based on the row as it is now");
  assert.deepEqual(rebased.conflicts, ["target_value"]);
  assert.equal(isLineDirty(rebased), true, "to be saved again");

  // Only the unit changed in the database: no conflict, nothing to save.
  const unitOnly = { ...scrapRow, values: { ...scrapRow.values, unit: "EA" } };
  const [quiet] = attachRecords([saved], [unitOnly], rowColumns);
  assert.deepEqual(quiet.conflicts, []);
  assert.equal(quiet.values.unit, "EA");
  assert.equal(isLineDirty(quiet), false);

  const [gone] = attachRecords([saved], [], rowColumns);
  assert.equal(gone.missing, true);
  assert.equal(attachRecords([saved], null, rowColumns)[0], saved, "rows not loaded: lines as they are");
});

test("an unsaved change of a row stays this page's line when someone else saved one", () => {
  const mine = { ...recordLine(scrapRow), values: { ...scrapRow.values, target_value: "15" } };
  const merged = mergeServerLines([mine], [{ intake_id: 9, row_version: 1, status: "pending", record_id: 12, base: scrapRow.values, values: scrapRow.values }]);
  assert.deepEqual(merged.map((line) => line.intake_id), [null], "saving it tells the person the row is already being changed");
  const reverted = recordLine(scrapRow);
  assert.deepEqual(mergeServerLines([reverted], []), [], "a row brought back to its values is no line of its own");
});

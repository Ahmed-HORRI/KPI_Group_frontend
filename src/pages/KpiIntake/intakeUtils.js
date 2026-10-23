// Lines of the KPI & Target Intake grids (/kpi-intake), as the page keeps them:
//   { key, intake_id, row_version, values, saved, status, errors, duplicate, ... }
// values: what is in the cells now; saved: what the server has (null for a new
// line). A cell holds text, or for a reference column the record picked in the
// list ({ id, label } -- { intake_id, label } for a KPI of the KPI grid).
//
// Signed-in users also see the rows already in the database. A row nobody
// changes is shown as a line of its own (status "record"); a line changing a
// row has record_id and base: the row's values it is based on. On a row, only
// the cells that differ from base are a change.

export const ENTITY_TYPES = ["kpi", "target_allocation"];

// ?tab= value of each grid.
export const TAB_OF_ENTITY = { kpi: "kpi", target_allocation: "allocation" };
export const ENTITY_OF_TAB = { kpi: "kpi", allocation: "target_allocation" };

// "KPI #12" / "Allocation #340".
export const RECORD_NOUN = { kpi: "KPI", target_allocation: "Allocation" };

export const STATUS_META = {
  record: { label: "In database", tone: "slate" },
  new: { label: "Not saved", tone: "slate" },
  pending: { label: "Ready", tone: "emerald" },
  error: { label: "To fix", tone: "red" },
  duplicate: { label: "Duplicate", tone: "amber" },
  submitted: { label: "Submitted", tone: "blue" },
  rejected: { label: "Rejected", tone: "slate" },
};

let lastKey = 0;
const nextKey = () => `line-${Date.now().toString(36)}-${(lastKey += 1)}`;

// Comparable text: no case, accents, double spaces or dash variants (as the server).
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// JSON with sorted keys and without empty cells: two lines with the same
// content give the same text.
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => !isEmptyValue(value[key]))
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "object") return !value.id && !value.intake_id && !String(value.label || "").trim();
  return !String(value).trim();
}

export function cellText(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? value.label || "" : String(value);
}

// A reference picked in a list (rather than typed).
export function isPickedReference(value) {
  return Boolean(value && typeof value === "object" && (value.id || value.intake_id));
}

export function defaultValues(columns) {
  const values = {};
  for (const column of columns) {
    if (column.defaultValue !== undefined) values[column.key] = column.defaultValue;
  }
  return values;
}

export function newLine(columns, values = defaultValues(columns)) {
  return {
    key: nextKey(),
    intake_id: null,
    row_version: null,
    values: { ...values },
    saved: null,
    status: "new",
    errors: {},
    duplicate: null,
    submitted_by: null,
  };
}

// A line changing a row is keyed by the row: the row and its change are one line of the grid.
const lineKey = (line) => (line.record_id ? `record-${line.record_id}` : `intake-${line.intake_id}`);

export function fromServerLine(line) {
  return {
    ...line,
    key: lineKey(line),
    values: { ...(line.values || {}) },
    saved: { ...(line.values || {}) },
    base: line.record_id ? { ...(line.base || {}) } : null,
    errors: line.errors || {},
    conflicts: line.conflicts || [],
  };
}

// A row of the database nobody changes yet, as a line of the grid.
export function recordLine(record) {
  return {
    key: `record-${record.record_id}`,
    record_id: record.record_id,
    intake_id: null,
    row_version: null,
    values: { ...record.values },
    saved: { ...record.values },
    base: { ...record.values },
    status: "record",
    errors: {},
    conflicts: [],
    duplicate: null,
    submitted_by: null,
  };
}

// A line with unsaved edits. A waiting line with a conflict (a cell changed in
// the database too) needs saving again: on the row as it is now. With the
// columns, a line changing a row compares its cells by value ("10.0" is 10).
export function isLineDirty(line, columns = null) {
  if (!line.intake_id && !line.record_id) return true;
  const edited =
    columns && line.record_id
      ? changedKeys(columns, line.values, line.saved).length > 0
      : stableStringify(line.values) !== stableStringify(line.saved);
  return edited || Boolean(line.intake_id && line.conflicts?.length);
}

const numberText = (value) => String(value ?? "").replace(/\s+/g, "").replace(/,/g, ".");

// Two cells hold the same value (as the server compares them): references by
// record, numbers by value, the rest by text.
export function sameCell(column, left, right) {
  if (isEmptyValue(left) || isEmptyValue(right)) return isEmptyValue(left) && isEmptyValue(right);
  if (column?.type === "ref" || typeof left === "object" || typeof right === "object") {
    const key = (value) =>
      typeof value !== "object"
        ? `text:${normalizeText(value)}`
        : value.id
          ? `id:${value.id}`
          : value.intake_id
            ? `line:${value.intake_id}`
            : `text:${normalizeText(value.label)}`;
    return key(left) === key(right);
  }
  if (column?.type === "number") {
    const [a, b] = [Number(numberText(left)), Number(numberText(right))];
    if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  }
  return String(left).trim() === String(right).trim();
}

// Columns whose cell differs between two sets of values.
export function changedKeys(columns, values = {}, other = {}) {
  return columns.filter((column) => !sameCell(column, values?.[column.key], other?.[column.key])).map((column) => column.key);
}

// A line changing a row, put on the row as it is now: the cells it does not
// change show the row's current values. A cell it changes that was changed in
// the database too since is a conflict, until the line is saved again (the
// person's value is kept, the grid shows the database's).
export function rebaseOnRecord(line, record, columns) {
  const current = record.values;
  const base = line.base || current;
  const withChanges = (source, keys) => {
    const result = { ...current };
    for (const key of keys) {
      if (isEmptyValue(source?.[key])) delete result[key];
      else result[key] = source[key];
    }
    return result;
  };
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const valueKeys = changedKeys(columns, line.values, base);
  const values = withChanges(line.values, valueKeys);
  const conflicts = [
    ...new Set([...(line.conflicts || []), ...valueKeys.filter((key) => !sameCell(byKey.get(key), base[key], current[key]))]),
  ].filter((key) => !sameCell(byKey.get(key), values[key], current[key]));
  return {
    ...line,
    values,
    saved: line.intake_id ? withChanges(line.saved, changedKeys(columns, line.saved, base)) : { ...current },
    base: { ...current },
    conflicts,
    missing: false,
  };
}

// The lines changing rows, put on the rows as loaded (records: null when the
// rows are not loaded -- visitors). A row gone from the database is flagged.
export function attachRecords(lines, records, columns) {
  if (!records) return lines;
  const byId = new Map(records.map((record) => [record.record_id, record]));
  return lines.map((line) => {
    if (!line.record_id) return line;
    const record = byId.get(line.record_id);
    if (!record) return line.missing ? line : { ...line, missing: true };
    if (!line.missing && stableStringify(line.base) === stableStringify(record.values)) return line;
    return rebaseOnRecord(line, record, columns);
  });
}

// Nothing typed: every cell empty or left at its default.
export function isLineEmpty(line, columns) {
  const defaults = defaultValues(columns);
  return columns.every((column) => {
    const value = line.values?.[column.key];
    return isEmptyValue(value) || (defaults[column.key] !== undefined && value === defaults[column.key]);
  });
}

// Lines to send when saving: new ones with content, and the changed ones.
export function linesToSave(lines, columns) {
  return lines.filter((line) => (line.intake_id || line.record_id ? isLineDirty(line, columns) : !isLineEmpty(line, columns)));
}

// Fresh lines from the server merged into what the page shows: a line being
// edited keeps its cells and the version it was loaded at (so someone else's
// change is detected when saving) but shows the new check results; new lines
// stay; lines gone from the server disappear unless they were being edited.
// A row this page is changing (unsaved) stays this page's line even if someone
// else saved a change of it meanwhile: saving then says so.
export function mergeServerLines(localLines, serverLines) {
  const local = new Map(localLines.filter((line) => line.intake_id).map((line) => [line.intake_id, line]));
  const unsaved = localLines.filter((line) => !line.intake_id && (!line.record_id || isLineDirty(line)));
  const changedHere = new Set(unsaved.filter((line) => line.record_id).map((line) => line.record_id));
  const merged = serverLines
    .filter((serverLine) => !changedHere.has(serverLine.record_id))
    .map((serverLine) => {
      const fresh = fromServerLine(serverLine);
      const current = local.get(serverLine.intake_id);
      if (!current || !isLineDirty(current)) return fresh;
      return {
        ...current,
        status: fresh.status,
        errors: fresh.errors,
        duplicate: fresh.duplicate,
      };
    });
  const serverIds = new Set(serverLines.map((line) => line.intake_id));
  const editedElsewhere = localLines.filter((line) => line.intake_id && !serverIds.has(line.intake_id) && isLineDirty(line));
  return [...merged, ...editedElsewhere, ...unsaved];
}

// --- Pasting from Excel -------------------------------------------------------

// Tab-separated text as Excel copies it -> rows of cells. A cell with a line
// break or a tab is quoted ("..."), with "" for a quote.
export function parseTable(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text ?? "").replace(/\r\n?/g, "\n");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

// "31/03/2026" -> "2026-03-31" (dates are entered as YYYY-MM-DD).
export function toIsoDate(text) {
  const value = String(text ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const european = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  if (!european) return null;
  const iso = `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

// A pasted cell as the grid holds it: options in their exact spelling, dates
// as YYYY-MM-DD, and a name that is exactly one label of a list as that
// record. Anything else stays as typed -- the server says what is wrong.
export function coerceCell(column, text, referenceOptions = []) {
  const value = String(text ?? "").trim();
  if (!value) return "";
  if (column.type === "enum") {
    const normalized = normalizeText(value);
    const option = column.options.find(
      (item) => normalizeText(item.value) === normalized || normalizeText(item.label) === normalized
    );
    return option ? option.value : value;
  }
  if (column.type === "date") return toIsoDate(value) || value;
  if (column.type === "ref") {
    const normalized = normalizeText(value);
    const matches = referenceOptions.filter((option) => normalizeText(option.label) === normalized);
    if (matches.length === 1) {
      const [match] = matches;
      return match.intake_id ? { intake_id: match.intake_id, label: match.label } : { id: match.id, label: match.label };
    }
    return value;
  }
  return value;
}

// Pasted rows -> line values. When the first row holds column titles (as in
// the grid, or the database column names), cells go by title; otherwise they
// go in grid order, from startColumn.
export function linesFromTable(rows, columns, { startColumn = 0, optionsFor = () => [] } = {}) {
  if (!rows.length) return { lines: [], byHeader: false, ignoredHeaders: [] };

  const columnByTitle = new Map();
  for (const column of columns) {
    columnByTitle.set(normalizeText(column.label), column);
    columnByTitle.set(normalizeText(column.key), column);
  }
  const header = rows[0].map((cell) => columnByTitle.get(normalizeText(cell)) || null);
  const titled = rows[0].filter((cell) => cell.trim());
  const byHeader = titled.length > 0 && header.filter(Boolean).length >= Math.ceil(titled.length / 2);

  const targets = byHeader ? header : rows[0].map((_, index) => columns[startColumn + index] || null);
  const ignoredHeaders = byHeader ? rows[0].filter((cell, index) => cell.trim() && !header[index]) : [];
  const dataRows = byHeader ? rows.slice(1) : rows;

  const lines = dataRows.map((cells) => {
    const values = {};
    cells.forEach((cell, index) => {
      const column = targets[index] || (byHeader ? null : columns[startColumn + index]);
      if (!column) return;
      const value = coerceCell(column, cell, optionsFor(column));
      if (!isEmptyValue(value)) values[column.key] = value;
    });
    return values;
  });
  return { lines, byHeader, ignoredHeaders };
}

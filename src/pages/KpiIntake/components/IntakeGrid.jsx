import { useId } from "react";
import { CopyIcon, TrashIcon } from "../../../components/icons.jsx";
import ReferenceInput from "./ReferenceInput.jsx";
import StatusChip from "./StatusChip.jsx";
import { cellText, isLineDirty, parseTable, sameCell, toIsoDate } from "../intakeUtils.js";

const COLUMN_WIDTHS = { text: 190, longtext: 260, number: 120, tolerance: 120, date: 160, enum: 170, ref: 250 };
const WIDE_COLUMNS = { kpi_name: 240, kpi_id: 300 };

const inputClass = (invalid) =>
  `h-9 w-full rounded-lg border bg-white px-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500 ${
    invalid ? "border-red-300 bg-red-50/60" : "border-slate-200"
  }`;

const formatInfo = (column, value) => {
  if (value === null || value === undefined || value === "") return "";
  if (column.type !== "datetime") return String(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const conditionText = (column, columns) => {
  const condition = column.requiredWhen;
  if (!condition) return "";
  const other = columns.find((item) => item.key === condition.key);
  const values = condition.values.map((value) => other?.options?.find((option) => option.value === value)?.label || value);
  return `Required when ${other?.label || condition.key} is ${values.join(" or ")}`;
};

function Cell({ column, value, invalid, disabled, onChange, referenceOptions, searchFor, gridId }) {
  const label = column.label;
  if (column.type === "ref") {
    return (
      <ReferenceInput
        value={value}
        onChange={onChange}
        options={referenceOptions(column)}
        search={searchFor(column)}
        invalid={invalid}
        disabled={disabled}
        ariaLabel={label}
      />
    );
  }

  const text = cellText(value);
  if (column.type === "enum") {
    const known = column.options.some((option) => option.value === text);
    return (
      <select
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass(invalid)}
      >
        <option value="">—</option>
        {!known && text ? <option value={text}>{text} (not in the list)</option> : null}
        {column.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "longtext") {
    return (
      <textarea
        aria-label={label}
        rows={1}
        value={text}
        disabled={disabled}
        title={text || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass(invalid)} block h-9 min-h-9 resize-y py-1.5 leading-5`}
      />
    );
  }

  if (column.type === "date" && (!text || toIsoDate(text) === text)) {
    return (
      <input
        type="date"
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass(invalid)}
      />
    );
  }

  const numeric = column.type === "number" || column.type === "tolerance";
  return (
    <>
      <input
        type="text"
        inputMode={numeric ? "decimal" : undefined}
        aria-label={label}
        value={text}
        disabled={disabled}
        title={text || undefined}
        placeholder={column.type === "date" ? "YYYY-MM-DD" : column.type === "tolerance" ? "5 or 5%" : undefined}
        list={column.suggestions ? `${gridId}-${column.key}` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass(invalid)} ${numeric ? "text-right tabular-nums" : ""}`}
      />
      {column.suggestions ? (
        <datalist id={`${gridId}-${column.key}`}>
          {column.suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}

// Reviewed lines: the values as the server understood them (the records picked, with their ids).
function ReadOnlyCell({ value }) {
  const text = cellText(value);
  return (
    <div className="max-w-[260px] truncate px-1 py-2 text-sm text-slate-700" title={text || undefined}>
      {text || <span className="text-slate-300">—</span>}
    </div>
  );
}

// One line per row, one column of the table per column: the page's spreadsheet.
// Pasting several cells copied from Excel fills the grid from the cell pasted into.
// Rows of the database (signed-in users) show, read only, infoColumns from
// records (record_id -> record); a cell that differs from the database is blue.
export default function IntakeGrid({
  columns,
  infoColumns = [],
  lines,
  records = new Map(),
  recordNoun = "Row",
  readOnly = false,
  disabled = false,
  onChangeCell,
  onDuplicate,
  onRemove,
  onPasteCells,
  referenceOptions,
  searchFor,
}) {
  const gridId = useId().replace(/:/g, "");

  const handlePaste = (event) => {
    if (readOnly || disabled) return;
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!/[\t\n]/.test(text.replace(/\n$/, ""))) return;
    const cell = event.target.closest?.("[data-row][data-col]");
    if (!cell) return;
    event.preventDefault();
    onPasteCells(Number(cell.dataset.row), Number(cell.dataset.col), parseTable(text));
  };

  return (
    <div className="max-h-[64vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 w-[220px] min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Line
            </th>
            {columns.map((column) => {
              const condition = conditionText(column, columns);
              return (
                <th
                  key={column.key}
                  style={{ minWidth: WIDE_COLUMNS[column.key] || COLUMN_WIDTHS[column.type] || 180 }}
                  className="border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-xs font-bold text-slate-600"
                  title={condition || undefined}
                >
                  <span className="whitespace-nowrap">
                    {column.label}
                    {column.required ? <span className="ml-0.5 text-red-500" aria-label="required">*</span> : null}
                    {condition ? <span className="ml-0.5 text-amber-500" aria-label={condition}>*</span> : null}
                  </span>
                </th>
              );
            })}
            {infoColumns.map((column) => (
              <th
                key={`info-${column.key}`}
                className="min-w-[120px] border-b border-l border-slate-200 bg-slate-100/70 px-2 py-2.5 text-xs font-bold text-slate-500"
                title="Set by the application — read only"
              >
                <span className="whitespace-nowrap">{column.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody onPaste={handlePaste}>
          {lines.map((line, rowIndex) => {
            const dirty = !readOnly && isLineDirty(line, columns);
            const record = line.record_id ? records.get(line.record_id) : null;
            // The row's values in the database (base: the row as it is now, once put on it).
            const databaseValues = line.record_id && !readOnly ? line.base || record?.values || {} : null;
            const conflicts = new Set(readOnly ? [] : line.conflicts || []);
            const status = line.intake_id ? line.status : line.record_id && !dirty ? "record" : "new";
            const rowMessage =
              line.errors?._row ||
              line.duplicate?.message ||
              (line.missing && !readOnly ? `This ${recordNoun} is no longer in the database (or not loaded) — drop the change.` : "");
            // The grid is wide: name the columns to fix, some may be out of view.
            const columnsToFix = columns
              .filter((column) => line.errors?.[column.key] || conflicts.has(column.key))
              .map((column) => column.label);
            const removable = line.intake_id || !line.record_id || dirty;
            const removeTitle = line.record_id
              ? line.intake_id
                ? "Drop this change"
                : "Undo my changes"
              : line.intake_id
                ? "Delete this line"
                : "Remove this line";
            return (
              <tr key={line.key} className="group align-top">
                <td className="sticky left-0 z-10 w-[220px] min-w-[220px] max-w-[220px] border-b border-r border-slate-100 bg-white px-3 py-2 group-hover:bg-slate-50/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusChip status={status} />
                        {dirty && line.intake_id ? (
                          <span className="text-[11px] font-semibold text-blue-600">edited</span>
                        ) : null}
                        {record && !record.active ? (
                          <span className="text-[11px] font-semibold text-slate-400">inactive</span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-400">
                        {line.record_id ? `${recordNoun} #${line.record_id}${line.intake_id ? ` · change #${line.intake_id}` : ""}` : null}
                        {!line.record_id ? (line.intake_id ? `#${line.intake_id}` : "new line") : null}
                        {line.submitted_by?.label ? ` · ${line.submitted_by.label.split(" — ")[0]}` : ""}
                        {line.created_record_id && !line.record_id ? ` · id ${line.created_record_id}` : ""}
                      </div>
                    </div>
                    {!readOnly ? (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onDuplicate(line)}
                          disabled={disabled}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                          title={line.record_id ? "Copy as a new line" : "Duplicate this line"}
                          aria-label={`Duplicate line ${rowIndex + 1}`}
                        >
                          <CopyIcon size={15} />
                        </button>
                        {removable ? (
                          <button
                            type="button"
                            onClick={() => onRemove(line)}
                            disabled={disabled}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title={removeTitle}
                            aria-label={`${removeTitle} (line ${rowIndex + 1})`}
                          >
                            <TrashIcon size={15} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {columnsToFix.length ? (
                    <p className="mt-1.5 text-[11px] leading-4 text-red-600" title={columnsToFix.join(", ")}>
                      To fix: {columnsToFix.join(", ")}
                    </p>
                  ) : null}
                  {rowMessage ? (
                    <p
                      className={`mt-1.5 text-[11px] leading-4 ${line.errors?._row ? "text-red-600" : "text-amber-700"}`}
                      title={rowMessage}
                    >
                      {rowMessage}
                    </p>
                  ) : null}
                  {line.review_comment ? (
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-500" title={line.review_comment}>
                      “{line.review_comment}”
                    </p>
                  ) : null}
                </td>
                {columns.map((column, colIndex) => {
                  const databaseValue = databaseValues?.[column.key];
                  const changed = databaseValues && !sameCell(column, line.values?.[column.key], databaseValue);
                  const error =
                    line.errors?.[column.key] ||
                    (conflicts.has(column.key)
                      ? `Changed in the database meanwhile (now: ${cellText(databaseValue) || "empty"}) — save to keep your value, or undo.`
                      : "");
                  return (
                    <td
                      key={column.key}
                      data-row={rowIndex}
                      data-col={colIndex}
                      title={changed ? `In the database: ${cellText(databaseValue) || "empty"}` : undefined}
                      className={`border-b border-slate-100 px-1.5 py-1.5 ${
                        changed ? "bg-blue-50 shadow-[inset_3px_0_0_#3b82f6]" : "group-hover:bg-slate-50/50"
                      }`}
                    >
                      {readOnly ? (
                        <ReadOnlyCell value={line.resolved?.[column.key] ?? line.values?.[column.key]} />
                      ) : (
                        <Cell
                          column={column}
                          value={line.values?.[column.key]}
                          invalid={Boolean(error)}
                          disabled={disabled}
                          onChange={(value) => onChangeCell(line.key, column.key, value)}
                          referenceOptions={referenceOptions}
                          searchFor={searchFor}
                          gridId={gridId}
                        />
                      )}
                      {error ? (
                        <p className="mt-1 max-w-[280px] text-[11px] leading-4 text-red-600" title={error}>
                          {error}
                        </p>
                      ) : null}
                    </td>
                  );
                })}
                {infoColumns.map((column) => {
                  const text = formatInfo(column, record?.info?.[column.key]);
                  return (
                    <td
                      key={`info-${column.key}`}
                      className="border-b border-l border-slate-100 bg-slate-50/60 px-2 py-2 text-sm text-slate-500"
                      title={column.type === "datetime" && record?.info?.[column.key] ? new Date(record.info[column.key]).toLocaleString() : undefined}
                    >
                      <span className="whitespace-nowrap">{text || <span className="text-slate-300">—</span>}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

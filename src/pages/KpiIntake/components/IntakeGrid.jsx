import { useId } from "react";
import { CopyIcon, TrashIcon } from "../../../components/icons.jsx";
import ReferenceInput from "./ReferenceInput.jsx";
import StatusChip from "./StatusChip.jsx";
import { cellText, isLineDirty, parseTable, sameCell, toIsoDate } from "../intakeUtils.js";

const COLUMN_WIDTHS = { text: 190, longtext: 260, number: 120, tolerance: 120, date: 160, enum: 170, ref: 250 };
const WIDE_COLUMNS = { kpi_name: 240, kpi_id: 300 };

const inputClass = (invalid) =>
  `h-9 w-full rounded-lg border bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/15 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 ${
    invalid ? "border-red-300 dark:border-red-500/50 bg-red-50/60 dark:bg-red-500/10" : "border-slate-200 dark:border-slate-700"
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
    <div className="max-w-[260px] truncate px-1 py-2 text-sm text-slate-700 dark:text-slate-200" title={text || undefined}>
      {text || <span className="text-slate-300 dark:text-slate-600">—</span>}
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
    <div className="max-h-[64vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 w-[220px] min-w-[220px] border-b border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Line
            </th>
            {columns.map((column) => {
              const condition = conditionText(column, columns);
              return (
                <th
                  key={column.key}
                  style={{ minWidth: WIDE_COLUMNS[column.key] || COLUMN_WIDTHS[column.type] || 180 }}
                  className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-2 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300"
                  title={condition || undefined}
                >
                  <span className="whitespace-nowrap">
                    {column.label}
                    {column.required ? <span className="ml-0.5 text-red-500 dark:text-red-400" aria-label="required">*</span> : null}
                    {condition ? <span className="ml-0.5 text-amber-500 dark:text-amber-400" aria-label={condition}>*</span> : null}
                  </span>
                </th>
              );
            })}
            {infoColumns.map((column) => (
              <th
                key={`info-${column.key}`}
                className="min-w-[120px] border-b border-l border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/70 px-2 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400"
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
                <td className="sticky left-0 z-10 w-[220px] min-w-[220px] max-w-[220px] border-b border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusChip status={status} />
                        {dirty && line.intake_id ? (
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">edited</span>
                        ) : null}
                        {record && !record.active ? (
                          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">inactive</span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
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
                          className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
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
                            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40"
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
                    <p className="mt-1.5 text-[11px] leading-4 text-red-600 dark:text-red-400" title={columnsToFix.join(", ")}>
                      To fix: {columnsToFix.join(", ")}
                    </p>
                  ) : null}
                  {rowMessage ? (
                    <p
                      className={`mt-1.5 text-[11px] leading-4 ${line.errors?._row ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"}`}
                      title={rowMessage}
                    >
                      {rowMessage}
                    </p>
                  ) : null}
                  {line.review_comment ? (
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400" title={line.review_comment}>
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
                      className={`border-b border-slate-100 dark:border-slate-800 px-1.5 py-1.5 ${
                        changed ? "bg-blue-50 dark:bg-blue-500/10 shadow-[inset_3px_0_0_var(--color-blue-500)]" : "group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/50"
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
                        <p className="mt-1 max-w-[280px] text-[11px] leading-4 text-red-600 dark:text-red-400" title={error}>
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
                      className="border-b border-l border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-2 py-2 text-sm text-slate-500 dark:text-slate-400"
                      title={column.type === "datetime" && record?.info?.[column.key] ? new Date(record.info[column.key]).toLocaleString() : undefined}
                    >
                      <span className="whitespace-nowrap">{text || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
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

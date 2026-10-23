import { useMemo, useState } from "react";
import Dialog, { buttonClasses } from "../../../components/Dialog.jsx";
import { ClipboardIcon } from "../../../components/icons.jsx";
import { linesFromTable, parseTable } from "../intakeUtils.js";

// Lines copied from Excel, added to the grid. With the column titles on the
// first row, the columns may be in any order; without them, they must follow
// the grid's order.
export default function PasteDialog({ title, columns, optionsFor, onAdd, onClose }) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => linesFromTable(parseTable(text), columns, { optionsFor }), [text, columns, optionsFor]);
  const count = parsed.lines.length;

  return (
    <Dialog
      title={`Paste ${title} lines from Excel`}
      subtitle="Copy the cells in Excel, then paste them below. Names are matched to the database when you save."
      icon={ClipboardIcon}
      size="lg"
      onClose={onClose}
      footerHint={
        text.trim()
          ? parsed.byHeader
            ? `Columns recognised by their titles.${parsed.ignoredHeaders.length ? ` Ignored: ${parsed.ignoredHeaders.join(", ")}.` : ""}`
            : "No column titles recognised: cells are taken in the grid's column order."
          : null
      }
      footer={
        <>
          <button type="button" className={buttonClasses.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonClasses.primary}
            disabled={!count}
            onClick={() => {
              onAdd(parsed.lines);
              onClose();
            }}
          >
            Add {count || ""} line{count === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <textarea
        data-autofocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={10}
        placeholder={`${columns
          .slice(0, 4)
          .map((column) => column.label)
          .join("\t")}\t…`}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Column titles: {columns.map((column) => column.label).join(", ")}.
      </p>
    </Dialog>
  );
}

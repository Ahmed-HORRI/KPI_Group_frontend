import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon } from "../../../components/icons.jsx";
import { cellText, isPickedReference, normalizeText } from "../intakeUtils.js";

const MAX_SHOWN = 60;
const SEARCH_DELAY_MS = 250;

// A name looked up in a list: typing filters the list (or searches the server,
// for people and customers); picking stores the record ({ id, label }). Text
// typed without picking is kept as is and matched by the server when saving.
// The list is rendered in a portal, so the scrolling grid never clips it.
export default function ReferenceInput({
  value,
  onChange,
  options = [],
  search = null,
  placeholder = "Type a name…",
  invalid = false,
  disabled = false,
  ariaLabel,
  className = "",
}) {
  const label = cellText(value);
  const picked = isPickedReference(value);
  const [text, setText] = useState(label);
  const [syncedLabel, setSyncedLabel] = useState(label);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [position, setPosition] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const searchSeq = useRef(0);
  const listId = useId();

  // A value set from outside (paste, reload) shows in the field.
  if (label !== syncedLabel) {
    setSyncedLabel(label);
    setText(label);
  }

  const visible = useMemo(() => {
    if (search) return results;
    const term = picked ? "" : normalizeText(text);
    const matching = term ? options.filter((option) => normalizeText(option.label).includes(term)) : options;
    return matching.slice(0, MAX_SHOWN);
  }, [options, picked, results, search, text]);

  // Server search (people, customers): two letters at least, debounced.
  useEffect(() => {
    if (!search || !open) return undefined;
    const term = picked ? "" : text.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    const seq = (searchSeq.current += 1);
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await search(term);
        if (seq === searchSeq.current) setResults(found);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open, picked, search, text]);

  const computePosition = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 300);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    const below = window.innerHeight - rect.bottom;
    const placeAbove = below < 240 && rect.top > below;
    setPosition({ left: Math.max(8, left), width, top: placeAbove ? null : rect.bottom + 4, bottom: placeAbove ? window.innerHeight - rect.top + 4 : null });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    computePosition();
    window.addEventListener("resize", computePosition);
    window.addEventListener("scroll", computePosition, true);
    return () => {
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("scroll", computePosition, true);
    };
  }, [open, computePosition]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Closed by a click anywhere else too, not only when the field loses focus.
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!inputRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  const openList = () => {
    if (!open) setActiveIndex(0);
    setOpen(true);
  };

  const pick = (option) => {
    const next = option.intake_id ? { intake_id: option.intake_id, label: option.label } : { id: option.id, label: option.label };
    setText(option.label);
    setOpen(false);
    onChange(next);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openList();
      else setActiveIndex((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && visible[activeIndex]) {
      event.preventDefault();
      pick(visible[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  const hint = search
    ? searching
      ? "Searching…"
      : picked || text.trim().length < 2
        ? "Type two letters or more to search."
        : "No match — what you typed will be checked when saving."
    : "No match — what you typed will be checked when saving.";

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        title={text || undefined}
        onFocus={openList}
        onClick={openList}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        onChange={(event) => {
          setText(event.target.value);
          setActiveIndex(0);
          setOpen(true);
          onChange(event.target.value.trim() ? event.target.value : "");
        }}
        className={`h-9 w-full rounded-lg border bg-white dark:bg-slate-800 pl-2.5 pr-7 text-sm text-slate-900 dark:text-white outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/15 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 ${
          invalid ? "border-red-300 dark:border-red-500/50 bg-red-50/60 dark:bg-red-500/10" : "border-slate-200 dark:border-slate-700"
        }`}
      />
      {picked ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 dark:text-emerald-400" title="Picked from the list">
          <CheckIcon size={14} />
        </span>
      ) : text.trim() ? (
        <span
          className="pointer-events-none absolute right-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-400"
          title="Typed text: it is matched to a record when you save"
        />
      ) : null}

      {open && position
        ? createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            onMouseDown={(event) => event.preventDefault()}
            style={{ left: position.left, width: position.width, top: position.top ?? undefined, bottom: position.bottom ?? undefined }}
            className="fixed z-[80] max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-xl shadow-slate-900/10 animate-kpi-pop"
          >
            {visible.length ? (
              visible.map((option, index) => {
                const selected =
                  picked && ((option.id && option.id === value.id) || (option.intake_id && option.intake_id === value.intake_id));
                return (
                  <div
                    key={option.intake_id ? `line-${option.intake_id}` : option.id}
                    role="option"
                    data-index={index}
                    aria-selected={selected}
                    onClick={() => pick(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                      index === activeIndex ? "bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-200" : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate" title={option.label}>
                      {option.label}
                    </span>
                    {option.intake_id ? (
                      <span className="shrink-0 rounded-full bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                        New
                      </span>
                    ) : null}
                    {selected ? <CheckIcon size={14} className="shrink-0 text-blue-600 dark:text-blue-400" /> : null}
                  </div>
                );
              })
            ) : (
              <div className="px-2.5 py-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
            )}
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

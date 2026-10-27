import { CloseIcon, SearchIcon } from "./icons.jsx";

// Text search of a filter bar: same height and look as SelectMenu, tinted while
// in use, with a button to empty it.
export function SearchField({ value, onChange, placeholder, label, className = "" }) {
  const active = Boolean(value);
  return (
    <div className={`relative flex min-w-0 items-center ${className}`}>
      <SearchIcon
        size={16}
        className={`pointer-events-none absolute left-3.5 ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={`h-11 w-full rounded-xl pl-10 pr-9 text-sm text-slate-800 shadow-sm outline-none ring-1 transition placeholder:text-slate-400 hover:ring-slate-300 focus:ring-2 focus:ring-blue-600/50 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:hover:ring-slate-600 dark:focus:ring-blue-500/60 ${
          active
            ? "bg-blue-50/70 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/40"
            : "bg-white ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        }`}
      />
      {active ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear the search"
          className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <CloseIcon size={14} />
        </button>
      ) : null}
    </div>
  );
}

// Shown while at least one filter is in use.
export function ClearFiltersButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <CloseIcon size={14} /> Clear filters
    </button>
  );
}

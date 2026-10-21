import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "./icons.jsx";

const GAP = 6;

// Single-choice dropdown (listbox) replacing a native <select>: the whole field
// opens it, the list matches the app, long lists get a search box, and options
// can be grouped. Rendered in a portal (like DropdownMenu) so a card with
// overflow-hidden never clips it; flips above the field when there is no room.
//
// options: [{ value, label, description?, hint?, icon?, group? }] -- description
// is a short note on the right (a count), hint a line of text under the label;
// a header is shown each time `group` changes from one option to the next.
// hideLabel: the label is only for assistive technology (e.g. a form field
// that already has a heading).
export default function SelectMenu({
  icon: Icon,
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search...",
  // The list is as wide as the field, and at least this wide (room for the search box).
  menuWidth = 240,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const typeahead = useRef({ text: "", timer: null });
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      [option.label, option.description, option.hint, option.group].some((text) =>
        String(text || "").toLowerCase().includes(term)
      )
    );
  }, [options, query]);

  const computePosition = useCallback(
    (menuHeight = 0) => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const width = Math.min(Math.max(rect.width, menuWidth), window.innerWidth - GAP * 2);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = menuHeight > 0 && spaceBelow < menuHeight + GAP * 2 && rect.top > spaceBelow;
      return {
        width,
        left: Math.max(GAP, Math.min(rect.left, window.innerWidth - width - GAP)),
        top: openUp ? Math.max(GAP, rect.top - menuHeight - GAP) : rect.bottom + GAP,
      };
    },
    [menuWidth]
  );

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = () => {
    setQuery("");
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setPosition(computePosition());
    setOpen(true);
  };

  const choose = (option) => {
    close(true);
    if (option.value !== value) onChange(option.value);
  };

  // Once rendered: flip above the field if needed, then focus the search or the list.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    setPosition(computePosition(menuRef.current.offsetHeight));
    (searchRef.current || listRef.current)?.focus({ preventScroll: true });
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      close(false);
    };
    const onScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const onMenuKeyDown = (event) => {
    const inSearch = event.target === searchRef.current;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(visible.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home" && !inSearch) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && !inSearch) {
      event.preventDefault();
      setActiveIndex(visible.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (visible[activeIndex]) choose(visible[activeIndex]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      // Handled here only: inside a Dialog, Escape must not also close the
      // dialog, and Tab must not leave it (the list is outside its panel).
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (!inSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // No search box: typing jumps to the first option starting with the typed text, like a native select.
      const state = typeahead.current;
      clearTimeout(state.timer);
      state.text += event.key.toLowerCase();
      state.timer = setTimeout(() => {
        state.text = "";
      }, 600);
      const match = visible.findIndex((option) => option.label.toLowerCase().startsWith(state.text));
      if (match >= 0) setActiveIndex(match);
    }
  };

  const optionId = (index) => `${listId}-option-${index}`;
  const activeDescendant = open && visible[activeIndex] ? optionId(activeIndex) : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
            event.preventDefault();
            openMenu();
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={hideLabel ? `${label}: ${selected?.label ?? ""}` : undefined}
        className={`relative flex h-11 min-w-0 items-center gap-2.5 rounded-xl bg-white pl-3.5 pr-9 text-left shadow-sm ring-1 transition hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D7]/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:ring-slate-200 dark:bg-slate-800 dark:shadow-none dark:hover:ring-slate-600 dark:focus-visible:ring-blue-500/60 ${
          open ? "ring-2 ring-[#0078D7]/40 dark:ring-blue-500/50" : "ring-slate-200 dark:ring-slate-700"
        } ${className}`}
      >
        {Icon ? <Icon size={16} className="shrink-0 text-slate-400 dark:text-slate-500" /> : null}
        {hideLabel ? null : (
          <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        )}
        {/* Every label is laid out invisibly in the same grid cell, so the field
            is as wide as its longest option and keeps that width whatever is picked. */}
        <span className="grid min-w-0 flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <span className="truncate [grid-area:1/1]">{selected?.label ?? "-"}</span>
          {options.map((option) => (
            <span key={option.value} aria-hidden="true" className="invisible h-0 whitespace-nowrap [grid-area:1/1]">
              {option.label}
            </span>
          ))}
        </span>
        <ChevronDownIcon
          size={16}
          className={`pointer-events-none absolute right-3 text-slate-400 transition dark:text-slate-500 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              onKeyDown={onMenuKeyDown}
              style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
              className="z-[80] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5 animate-kpi-pop dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50 dark:ring-black/20"
            >
              {searchable ? (
                <div className="border-b border-slate-100 p-2 dark:border-slate-800">
                  <div className="relative">
                    <SearchIcon
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                      }}
                      placeholder={searchPlaceholder}
                      role="combobox"
                      aria-label={`Search ${label}`}
                      aria-expanded="true"
                      aria-controls={listId}
                      aria-activedescendant={activeDescendant}
                      aria-autocomplete="list"
                      className="h-9 w-full rounded-lg bg-slate-50 pl-8 pr-3 text-sm text-slate-800 outline-none ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-[#0078D7]/40 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              ) : null}

              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={label}
                tabIndex={-1}
                aria-activedescendant={searchable ? undefined : activeDescendant}
                className="max-h-[22rem] overflow-y-auto p-1.5 outline-none"
              >
                {visible.length ? (
                  visible.map((option, index) => {
                    const isSelected = option.value === value;
                    const isActive = index === activeIndex;
                    const showGroup = option.group && option.group !== visible[index - 1]?.group;
                    return (
                      <div key={option.value}>
                        {showGroup ? (
                          <div
                            role="presentation"
                            className="px-2.5 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500"
                          >
                            {option.group}
                          </div>
                        ) : null}
                        <div
                          id={optionId(index)}
                          data-index={index}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => choose(option)}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                            isActive ? "bg-slate-100 dark:bg-slate-800" : ""
                          } ${
                            isSelected
                              ? "font-semibold text-[#0078D7] dark:text-blue-400"
                              : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {option.icon ? (
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isSelected
                                  ? "bg-blue-50 text-[#0078D7] dark:bg-blue-500/15 dark:text-blue-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              <option.icon size={16} />
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{option.label}</span>
                            {option.hint ? (
                              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{option.hint}</span>
                            ) : null}
                          </span>
                          {option.description ? (
                            <span className="shrink-0 text-xs font-normal text-slate-400 dark:text-slate-500">
                              {option.description}
                            </span>
                          ) : null}
                          <CheckIcon size={16} className={`shrink-0 ${isSelected ? "" : "invisible"}`} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                    No match for "{query.trim()}".
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

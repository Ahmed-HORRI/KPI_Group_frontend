import { useEffect, useId, useMemo, useRef, useState } from "react";
import { inputClass } from "./ui.jsx";
import {
  findSelectedSubject,
  getSubjectFlowColumns,
  getSubjectFlowIds,
  indexSubjectTree,
  isFinalSubject,
  subjectMatchesSearch,
} from "./subjectHierarchy.js";

const LEVEL_TITLES = ["Parent subjects", "Related subjects", "Sub-category", "KPI subjects", "Level 5"];

export default function SubjectTreePicker({
  tree,
  subjectId,
  value,
  onChange,
  open,
  onOpenChange,
  loading = false,
  error = "",
}) {
  const panelId = useId();
  const labelId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const columnsRef = useRef(null);
  const [search, setSearch] = useState("");
  const [browsedIds, setBrowsedIds] = useState(null);
  const index = useMemo(() => indexSubjectTree(tree), [tree]);
  const selected = findSelectedSubject(index, subjectId, value);
  const flowIds = browsedIds ?? getSubjectFlowIds(index, selected?.id);
  const columns = getSubjectFlowColumns(tree, flowIds);
  const browsingNode = index.get(flowIds.at(-1));
  const displayPath = (open ? browsingNode?.full_path : selected?.full_path) || value;
  const flowKey = flowIds.join("/");

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open && columnsRef.current) {
      columnsRef.current.scrollTo({ left: columnsRef.current.scrollWidth, behavior: "smooth" });
    }
  }, [open, flowKey]);

  const chooseNode = (node, level) => {
    setBrowsedIds([...flowIds.slice(0, level), String(node.id)]);
    if (isFinalSubject(node, level)) {
      onChange(node);
      onOpenChange(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="min-w-0">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span id={labelId} className="font-semibold text-slate-600 dark:text-slate-300">
          Subject <span className="text-red-500 dark:text-red-400">*</span>
        </span>
        <span className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">Excel hierarchy tree</span>
      </div>
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={loading || Boolean(error)}
        className={`${inputClass} flex items-center justify-between gap-3 text-left`}
        onClick={() => {
          if (!open) {
            setBrowsedIds(null);
            setSearch("");
          }
          onOpenChange(!open);
        }}
      >
        <span className="min-w-0">
          <span className="block break-words font-semibold">
            {loading ? "Loading subjects..." : displayPath || "Select subject from tree"}
          </span>
          {!displayPath && !loading ? (
            <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">Open the visual hierarchy to choose a subject and follow its branch.</span>
          ) : null}
        </span>
        <span aria-hidden="true" className="shrink-0 text-xs text-blue-600 dark:text-blue-400">{open ? "▴" : "▾"}</span>
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {open ? (
        <div
          id={panelId}
          className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onOpenChange(false);
              triggerRef.current?.focus();
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <input
              ref={searchRef}
              className={`${inputClass} max-w-xs`}
              placeholder="Filter subjects..."
              aria-label="Filter subjects"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              onClick={() => {
                setBrowsedIds([]);
                setSearch("");
                searchRef.current?.focus();
              }}
            >
              × Reset
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">Choose a final subject to confirm.</span>
          </div>
          {tree.length ? (
            <div ref={columnsRef} className="overflow-x-auto">
              <div className="flex w-max">
                {columns.map((nodes, level) => {
                  const filtered = nodes.filter((node) => subjectMatchesSearch(node, search));
                  return (
                    <div key={level} className="w-56 shrink-0 border-r border-slate-100 last:border-r-0 dark:border-slate-800">
                      <div className="flex flex-col gap-0.5 border-b border-slate-100 bg-blue-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-blue-500/10">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Level {level + 1}</span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{LEVEL_TITLES[level]}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{filtered.length} items</span>
                      </div>
                      <div className="h-[min(24rem,50vh)] overflow-y-auto p-1">
                        {filtered.map((node) => {
                          const final = isFinalSubject(node, level);
                          const highlighted = flowIds[level] === String(node.id);
                          return (
                            <button
                              key={node.id}
                              type="button"
                              aria-pressed={highlighted}
                              className={`mb-1 flex w-full items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left ${highlighted ? "border-blue-300 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/15" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                              onClick={() => chooseNode(node, level)}
                            >
                              <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">L{level}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block break-words text-xs font-bold text-slate-900 dark:text-slate-100">{node.name}</span>
                                <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
                                  {final ? (node.children.length ? "Select this subject" : "Leaf · select this") : `${node.children.length} ${node.children.length === 1 ? "child" : "children"}`}
                                </span>
                              </span>
                              {!final ? <span aria-hidden="true" className="text-[10px] text-slate-400 dark:text-slate-500">▶</span> : null}
                            </button>
                          );
                        })}
                        {!filtered.length ? <p className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">No matches</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No active subjects are available.</p>}
        </div>
      ) : null}
    </div>
  );
}

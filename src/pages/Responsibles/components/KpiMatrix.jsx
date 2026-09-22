import { useMemo } from "react";
import {
  DeleteIcon,
  EditIcon,
  EmptyState,
  IconButton,
  ViewIcon,
  inputClass,
} from "./ui.jsx";
import { formatParameterDisplayValue, getLastPathSegment } from "./formatting.js";

// Port of the original page's "KPI Matrix" section (renderKpis / loadKpis /
// groupKpiRowsBySubject / initializeKpiConsultFilters / applyKpiConsultFilters).
//
// Simplification: the original's two custom searchable dropdowns (KPI name,
// Subject) are plain <select> elements here. Their option lists and filter
// semantics are identical (unique sorted values from the loaded rows, exact
// match filtering, "All" resets).

export function getKpiSubjectPath(row) {
  return String(row?.full_subject_path || row?.subject || row?.indicator_title || "").trim();
}

export function getKpiSubjectGroupKey(row) {
  const subjectPath = getKpiSubjectPath(row);
  if (subjectPath) return `subject:${subjectPath.toLowerCase()}`;
  return `subject:unassigned:${String(row?.kpi_id || "")}`;
}

export function getKpiSubjectDisplayName(row) {
  const subjectPath = getKpiSubjectPath(row);
  return getLastPathSegment(subjectPath) || subjectPath || "No KPI hierarchy attached";
}

export function groupKpiRowsBySubject(rows) {
  const groupedSubjects = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const subjectKey = getKpiSubjectGroupKey(row);
    if (!groupedSubjects.has(subjectKey)) {
      groupedSubjects.set(subjectKey, {
        key: subjectKey,
        subject_path: getKpiSubjectPath(row),
        subject_name: getKpiSubjectDisplayName(row),
        rows: [],
      });
    }
    groupedSubjects.get(subjectKey).rows.push(row);
  });
  return Array.from(groupedSubjects.values()).map((group) => ({
    ...group,
    kpi_count: group.rows.length,
  }));
}

function uniqueSorted(rows, getter) {
  return Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .map(getter)
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export default function KpiMatrix({
  sourceRows,
  search,
  onSearchChange,
  nameFilter,
  onNameFilterChange,
  subjectFilter,
  onSubjectFilterChange,
  expandedKeys,
  onToggleGroup,
  loading,
  isOwned,
  onAdd,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  duplicatingId,
}) {
  const nameOptions = useMemo(
    () => uniqueSorted(sourceRows, (row) => row.indicator_sub_title),
    [sourceRows]
  );
  const subjectOptions = useMemo(
    () => uniqueSorted(sourceRows, (row) => getLastPathSegment(row.full_subject_path || row.subject)),
    [sourceRows]
  );

  // applyKpiConsultFilters() + renderKpis() sorting (owned KPIs first, then by name).
  const filteredRows = useMemo(() => {
    let rows = Array.isArray(sourceRows) ? sourceRows.slice() : [];
    if (nameFilter) {
      rows = rows.filter((row) => String(row.indicator_sub_title || "").trim() === nameFilter);
    }
    if (subjectFilter) {
      rows = rows.filter(
        (row) => getLastPathSegment(row.full_subject_path || row.subject) === subjectFilter
      );
    }
    rows.sort((left, right) => {
      const leftOwned = Boolean(left?.is_owned_by_responsible);
      const rightOwned = Boolean(right?.is_owned_by_responsible);
      if (leftOwned !== rightOwned) return leftOwned ? -1 : 1;
      return String(left?.indicator_sub_title || "").localeCompare(
        String(right?.indicator_sub_title || "")
      );
    });
    return rows;
  }, [sourceRows, nameFilter, subjectFilter]);

  const subjectGroups = useMemo(() => groupKpiRowsBySubject(filteredRows), [filteredRows]);
  const totalKpiCount = sourceRows.length;
  const visibleCount = filteredRows.length;

  const footerText =
    visibleCount === totalKpiCount
      ? `Showing ${subjectGroups.length} subject${subjectGroups.length === 1 ? "" : "s"} • ${visibleCount} KPI${visibleCount === 1 ? "" : "s"}`
      : `Showing ${subjectGroups.length} subject${subjectGroups.length === 1 ? "" : "s"} • ${visibleCount} of ${totalKpiCount} KPIs`;

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">KPI Matrix</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
            View and manage all KPI definitions with direct visibility on KPI name, KPI subject, KPI
            code, unit, direction, and actions.
          </p>
        </div>
        <button
          type="button"
          className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5"
          onClick={onAdd}
        >
          + Add KPI
        </button>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Search KPI
          </label>
          <input
            className={inputClass}
            placeholder="Search by subject, name, code, unit or direction..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            KPI name
          </label>
          <select
            className={inputClass}
            value={nameFilter}
            onChange={(e) => onNameFilterChange(e.target.value)}
          >
            <option value="">All</option>
            {nameOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Subject
          </label>
          <select
            className={inputClass}
            value={subjectFilter}
            onChange={(e) => onSubjectFilterChange(e.target.value)}
          >
            <option value="">All</option>
            {subjectOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <EmptyState>Loading KPIs...</EmptyState>
      ) : !visibleCount ? (
        <EmptyState>No KPI found.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">KPI Name</th>
                  <th className="px-4 py-3">KPI Subject</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjectGroups.map((group) => {
                  const isExpanded = expandedKeys.has(group.key);
                  return (
                    <ExpandableGroup
                      key={group.key}
                      group={group}
                      isExpanded={isExpanded}
                      onToggle={() => onToggleGroup(group.key)}
                      isOwned={isOwned}
                      onView={onView}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                      duplicatingId={duplicatingId}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>{footerText}</span>
            <span>KPI definition matrix grouped by subject</span>
          </div>
        </div>
      )}
    </section>
  );
}

function ExpandableGroup({
  group,
  isExpanded,
  onToggle,
  isOwned,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  duplicatingId,
}) {
  return (
    <>
      <tr className="border-t border-slate-100 bg-slate-50/60">
        <td colSpan={5} className="px-2 py-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-slate-100/70"
          >
            <span className="text-slate-400">{isExpanded ? "▾" : "▸"}</span>
            <span className="flex-1">
              <span className="block font-bold text-slate-800">
                {group.subject_name || "No KPI hierarchy attached"}
              </span>
              <span className="block text-xs text-slate-400">
                {group.subject_path || "No KPI hierarchy attached"}
              </span>
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 shadow-sm">
              {group.kpi_count} KPI{group.kpi_count === 1 ? "" : "s"}
            </span>
          </button>
        </td>
      </tr>
      {isExpanded
        ? group.rows.map((row) => {
            const owned = isOwned(row);
            return (
              <tr key={row.kpi_id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-800">
                    {row.indicator_sub_title || "Untitled KPI"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {[
                      row.status ? `Status: ${row.status}` : "",
                      row.frequency ? `Frequency: ${row.frequency}` : "",
                      owned ? "My KPI" : "Visible in consult mode",
                    ]
                      .filter(Boolean)
                      .join(" • ") || "No KPI details"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-700">
                    {getKpiSubjectDisplayName(row) || "No subject"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {getKpiSubjectPath(row) || "No KPI hierarchy attached"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-700">{row.unit || "-"}</div>
                  <div className="text-xs text-slate-400">
                    {row.target !== null && row.target !== undefined && String(row.target).trim() !== ""
                      ? `Target: ${formatParameterDisplayValue(row.target)}`
                      : "No unit target"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-700">{row.target_direction || "-"}</div>
                  <div className="text-xs text-slate-400">
                    {row.target_auto_adjustment
                      ? `Auto adjust: ${row.target_auto_adjustment}`
                      : "No direction setting"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    <IconButton
                      title="Duplicate KPI"
                      tone="slate"
                      disabled={String(duplicatingId) === String(row.kpi_id)}
                      onClick={() => onDuplicate(row.kpi_id)}
                    >
                      Duplicate
                    </IconButton>
                    <IconButton title="View KPI details" tone="blue" onClick={() => onView(row.kpi_id)}>
                      <ViewIcon />
                    </IconButton>
                    <IconButton title="Edit KPI" tone="slate" onClick={() => onEdit(row.kpi_id)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton title="Delete KPI" tone="red" onClick={() => onDelete(row.kpi_id)}>
                      <DeleteIcon />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}

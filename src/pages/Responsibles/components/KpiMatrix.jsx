import { useMemo } from "react";
import {
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  EmptyState,
  GroupToggle,
  IconButton,
  StatTile,
  StatusPill,
  ViewHeader,
  ViewIcon,
  inputClass,
  toneForDirection,
  toneForStatus,
} from "./ui.jsx";
import { ClipboardIcon } from "../../../components/icons.jsx";
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
  const ownedCount = useMemo(
    () => sourceRows.filter((row) => isOwned(row)).length,
    [sourceRows, isOwned]
  );
  const allSubjectCount = useMemo(() => groupKpiRowsBySubject(sourceRows).length, [sourceRows]);

  const footerText =
    visibleCount === totalKpiCount
      ? `Showing ${subjectGroups.length} subject${subjectGroups.length === 1 ? "" : "s"} • ${visibleCount} KPI${visibleCount === 1 ? "" : "s"}`
      : `Showing ${subjectGroups.length} subject${subjectGroups.length === 1 ? "" : "s"} • ${visibleCount} of ${totalKpiCount} KPIs`;

  return (
    <section>
      <ViewHeader
        icon={ClipboardIcon}
        title="KPI Matrix"
        description="View and manage all KPI definitions with direct visibility on KPI name, KPI subject, KPI code, unit, direction, and actions."
        actions={
          <button
            type="button"
            className="rounded-2xl btn-brand px-5 py-3 text-sm font-extrabold shadow-lg transition hover:-translate-y-0.5"
            onClick={onAdd}
          >
            + Add KPI
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
      </ViewHeader>

      {!loading ? (
        <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <StatTile label="Total KPIs" value={totalKpiCount} />
          <StatTile label="Subjects" value={allSubjectCount} tone="navy" />
          <StatTile label="My KPIs" value={ownedCount} tone="blue" />
          <StatTile label="Consult only" value={totalKpiCount - ownedCount} tone="muted" />
        </div>
      ) : null}

      {loading ? (
        <EmptyState>Loading KPIs...</EmptyState>
      ) : !visibleCount ? (
        <EmptyState>No KPI found.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
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
      <tr className="border-t border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40">
        <td colSpan={5} className="px-2 py-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
          >
            <GroupToggle expanded={isExpanded} />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm dark:bg-blue-500/10">
              📁
            </span>
            <span className="flex-1">
              <span className="block font-bold text-slate-800 dark:text-white">
                {group.subject_name || "No KPI hierarchy attached"}
              </span>
              <span className="block text-xs text-slate-400 dark:text-slate-500">
                {group.subject_path || "No KPI hierarchy attached"}
              </span>
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-300">
              {group.kpi_count} KPI{group.kpi_count === 1 ? "" : "s"}
            </span>
          </button>
        </td>
      </tr>
      {isExpanded
        ? group.rows.map((row) => {
            const owned = isOwned(row);
            return (
              <tr key={row.kpi_id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {row.indicator_sub_title || "Untitled KPI"}
                    </span>
                    {row.status ? <StatusPill tone={toneForStatus(row.status)}>{row.status}</StatusPill> : null}
                    {owned ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                        Mine
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {row.frequency ? `Frequency: ${row.frequency}` : "No frequency set"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {getKpiSubjectDisplayName(row) || "No subject"}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {getKpiSubjectPath(row) || "No KPI hierarchy attached"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">{row.unit || "-"}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {row.target !== null && row.target !== undefined && String(row.target).trim() !== ""
                      ? `Target: ${formatParameterDisplayValue(row.target)}`
                      : "No unit target"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusPill tone={toneForDirection(row.target_direction)}>
                    {row.target_direction || null}
                  </StatusPill>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {row.target_auto_adjustment
                      ? `Auto adjust: ${row.target_auto_adjustment}`
                      : "No direction setting"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-1.5 rounded-xl bg-slate-50/80 p-1 dark:bg-slate-800/60">
                    <IconButton
                      title="Duplicate KPI"
                      tone="slate"
                      disabled={String(duplicatingId) === String(row.kpi_id)}
                      onClick={() => onDuplicate(row.kpi_id)}
                    >
                      <DuplicateIcon />
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

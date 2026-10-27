import { useMemo } from "react";
import {
  DeleteIcon,
  EditIcon,
  EmptyState,
  GroupToggle,
  IconButton,
  StatTile,
  StatusPill,
  inputClass,
  toneForAllocationType,
} from "./ui.jsx";
import { formatParameterDisplayDate, formatParameterDisplayValue } from "./formatting.js";
import {
  buildParameterScopeSummary,
  filterParameterRows,
  formatParameterCountLabel,
  getMultisiteUnitTargetCount,
  getParameterGroupedScopeKindLabel,
  groupParameterRowsBySubject,
} from "./allocationHelpers.js";

// Port of the original page's "Target Allocation Matrix" section
// (renderParameterKpis / applyParameterSearch / groupParameterRowsBySubject).

export default function TargetAllocationMatrix({
  sourceRows,
  search,
  onSearchChange,
  expandedKeys,
  onToggleGroup,
  loading,
  loadError,
  onAdd,
  onEdit,
  onDelete,
}) {
  const filteredRows = useMemo(
    () => filterParameterRows(sourceRows, search),
    [sourceRows, search]
  );
  const subjectGroups = useMemo(() => groupParameterRowsBySubject(filteredRows), [filteredRows]);

  const visibleCount = filteredRows.length;
  const totalCount = sourceRows.length;
  const visibleSubjectCount = subjectGroups.length;
  const allSubjectCount = useMemo(() => groupParameterRowsBySubject(sourceRows).length, [sourceRows]);
  const multisiteCount = useMemo(
    () => sourceRows.filter((row) => String(row.kpi_type || "").trim().toLowerCase() === "multisite").length,
    [sourceRows]
  );

  const meta = !visibleCount
    ? totalCount > 0
      ? "No matching subjects"
      : "0 subjects"
    : visibleCount === totalCount
      ? `${visibleSubjectCount} subject${visibleSubjectCount === 1 ? "" : "s"} • ${visibleCount} allocation${visibleCount === 1 ? "" : "s"}`
      : `${visibleSubjectCount} subject${visibleSubjectCount === 1 ? "" : "s"} • ${visibleCount} of ${totalCount} allocations`;

  const footerText =
    visibleCount === totalCount
      ? `Showing ${visibleSubjectCount} subject${visibleSubjectCount === 1 ? "" : "s"} • ${visibleCount} allocation${visibleCount === 1 ? "" : "s"}`
      : `Showing ${visibleSubjectCount} subject${visibleSubjectCount === 1 ? "" : "s"} • ${visibleCount} of ${totalCount} allocations`;

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Target Allocation Matrix
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            View and manage KPI target allocations grouped by subject first, then open each subject
            to see the related KPIs, roles, frequencies, and target values.
          </p>
        </div>
        <button
          type="button"
          className="rounded-2xl btn-brand px-5 py-3 text-sm font-extrabold shadow-lg transition hover:-translate-y-0.5"
          onClick={onAdd}
        >
          + Add Target Allocation
        </button>
      </div>

      {!loading && !loadError ? (
        <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <StatTile label="Total allocations" value={totalCount} />
          <StatTile label="Subjects" value={allSubjectCount} tone="navy" />
          <StatTile label="Multisite" value={multisiteCount} tone="orange" />
          <StatTile label="Other scopes" value={totalCount - multisiteCount} tone="blue" />
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <input
          className={`${inputClass} max-w-xl`}
          placeholder="Filter by subject, KPI name, role, type, or frequency..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{meta}</span>
      </div>

      {loading ? (
        <EmptyState>Loading KPI target allocations...</EmptyState>
      ) : loadError ? (
        <EmptyState>Failed to load KPI target allocations.</EmptyState>
      ) : !visibleCount ? (
        <EmptyState>No KPI target allocation found for the current search.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Subject / KPI</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Target Value</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjectGroups.map((group) => {
                  const isExpanded = expandedKeys.has(group.key);
                  return (
                    <AllocationGroup
                      key={group.key}
                      group={group}
                      isExpanded={isExpanded}
                      onToggle={() => onToggleGroup(group.key)}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
            <span>{footerText}</span>
            <span>Target allocation matrix grouped by subject</span>
          </div>
        </div>
      )}
    </section>
  );
}

function AllocationGroup({ group, isExpanded, onToggle, onEdit, onDelete }) {
  return (
    <>
      <tr className="border-t border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40">
        <td colSpan={6} className="px-2 py-0">
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
              {group.allocation_count} KPI{group.allocation_count === 1 ? "" : "s"}
            </span>
          </button>
        </td>
      </tr>
      {isExpanded
        ? group.rows.map((row) => {
            const isMultisite = String(row.kpi_type || "").trim().toLowerCase() === "multisite";
            const groupRowCount = Number(row.group_row_count || 0);

            const targetMain = isMultisite
              ? formatParameterCountLabel(getMultisiteUnitTargetCount(row), "unit target", "unit targets")
              : groupRowCount > 1
                ? `${groupRowCount} ${getParameterGroupedScopeKindLabel(row, 1)} targets`
                : `${formatParameterDisplayValue(row.target_value)}${row.target_unit ? ` ${row.target_unit}` : ""}`;

            const targetSub =
              [
                row.kpi_type,
                isMultisite
                  ? formatParameterCountLabel(groupRowCount || 1, "linked row", "linked rows")
                  : groupRowCount > 1
                    ? `${groupRowCount} linked rows`
                    : "",
                row.target_setup_date ? `Setup ${formatParameterDisplayDate(row.target_setup_date)}` : "",
                row.target_start_date ? `Start ${formatParameterDisplayDate(row.target_start_date)}` : "",
                row.target_end_date ? `End ${formatParameterDisplayDate(row.target_end_date)}` : "",
              ]
                .filter(Boolean)
                .join(" • ") || "Target allocation";

            return (
              <tr key={row.kpi_target_allocation_id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-800 dark:text-white">
                    {row.kpi_name && row.kpi_group && row.kpi_name !== row.kpi_group
                      ? row.kpi_name
                      : row.kpi_subject || row.kpi_group || "No KPI hierarchy attached"}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {row.kpi_group || row.kpi_name || "Linked KPI"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusPill tone={toneForAllocationType(row.kpi_type)}>{row.kpi_type || "Not Set"}</StatusPill>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {[buildParameterScopeSummary(row), row.local_currency].filter(Boolean).join(" • ") ||
                      "No KPI type context"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">{row.role_name || "Not Set"}</div>
                  {(() => {
                    const roleMeta = [row.unit_type_name, row.function].filter(Boolean).join(" • ");
                    if (roleMeta) return <div className="text-xs text-slate-400 dark:text-slate-500">{roleMeta}</div>;
                    if (!row.role_name) return <div className="text-xs text-slate-400 dark:text-slate-500">No role linked</div>;
                    return null;
                  })()}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">{row.frequency || "-"}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {row.frequency ? "Frequency from selected KPI" : "No frequency linked"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-slate-800 dark:text-white">{targetMain}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{targetSub}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-1.5 rounded-xl bg-slate-50/80 p-1 dark:bg-slate-800/60">
                    <IconButton
                      title="Edit allocation"
                      tone="slate"
                      onClick={() => onEdit(row.kpi_target_allocation_id)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      title="Delete allocation"
                      tone="red"
                      onClick={() => onDelete(row.kpi_target_allocation_id)}
                    >
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

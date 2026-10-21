import { useEffect, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../../api/client";
import SelectMenu from "../../../components/SelectMenu.jsx";
import { ClearFiltersButton, SearchField } from "../../../components/FilterControls.jsx";
import { ActivityIcon, ChartIcon, DashboardIcon, TargetIcon } from "../../../components/icons.jsx";
import { EmptyState, StatusPill } from "../../Responsibles/components/ui.jsx";
import { TONE_DOT, formatDateTime } from "./adminUi";

const TYPE_OPTIONS = [
  { value: "", label: "All items", icon: DashboardIcon },
  { value: "kpi", label: "KPIs", icon: ChartIcon },
  { value: "target_allocation", label: "Target allocations", icon: TargetIcon },
];

const ACTION_META = {
  created: { label: "Created", tone: "green" },
  updated: { label: "Updated", tone: "blue" },
  deleted: { label: "Deleted", tone: "red" },
};

// Each dot has the colour of the matching pill in the table.
const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  ...Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label, dot: TONE_DOT[meta.tone] })),
];

const SOURCE_LABELS = {
  dashboard: "Responsible KPI Dashboard",
  kpi_admin: "KPI admin page",
  target_review: "Target adjustment approval",
};

// Column names of public.kpi / public.kpi_target_allocation, in plain words.
const FIELD_LABELS = {
  kpi_name: "Name",
  kpi_sub_title: "Subtitle",
  kpi_code: "Code",
  kpi_explanation: "Explanation",
  kpi_formula: "Formula",
  target_value: "Target",
  target_direction: "Direction",
  target_auto_adjustment: "Auto adjustment",
  min_value: "Min",
  min_type: "Min type",
  max_value: "Max",
  max_type: "Max type",
  low_limit: "Low limit",
  high_limit: "High limit",
  tolerance_type: "Tolerance type",
  low_tolerance: "Low tolerance",
  up_tolerance: "Up tolerance",
  unit: "Unit",
  frequency: "Frequency",
  nombre_periode: "Periods",
  calculation_mode: "Calculation mode",
  calculation_on: "Calculated on",
  display_trend: "Trend",
  regression: "Regression",
  reference_kpi_id: "Reference KPI",
  owner_role_id: "Owner role",
  status: "Status",
  comments: "Comments",
  currency_type: "Currency",
  kfs: "KFS",
  reactivity_status: "Reactivity status",
  importance: "Importance",
  reactivity_need: "Reactivity need",
  pricing_type: "Pricing type",
  file: "Attached file",
  type: "Type",
  is_active: "Active",
  created_by_people_id: "Owner",
  plant_id: "Plant",
  zone_id: "Zone",
  unit_id: "Unit",
  function: "Function",
  product_id: "Product",
  product_line_id: "Product line",
  market_id: "Market",
  customer_id: "Customer",
  target_unit: "Target unit",
  local_currency: "Local currency",
  kpi_type: "Allocation type",
  target_setup_date: "Setup date",
  target_start_date: "Start date",
  target_end_date: "End date",
  last_best_target: "Best target",
  previous_target_value: "Previous target",
  target_status: "Target status",
  set_by_people_id: "Responsible",
  approved_by_people_id: "Approved by",
  unit_type_id: "Unit type",
  role_id: "Role",
  kpi_id: "KPI",
};

const fieldLabel = (field) =>
  FIELD_LABELS[field] || field.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value);
};

// How many changed fields are shown before "+N more".
const PREVIEW_COUNT = 3;

function ChangeDetails({ change }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(change.changes || {});
  const shown = expanded ? entries : entries.slice(0, PREVIEW_COUNT);
  const hidden = entries.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {shown.map(([field, { from, to }]) => (
        <div key={field} className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-300">{fieldLabel(field)}</span>
          {change.action === "updated" ? (
            <>
              <span className="max-w-[14rem] truncate text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600" title={formatValue(from)}>
                {formatValue(from)}
              </span>
              <span className="text-slate-400 dark:text-slate-500">→</span>
              <span className="max-w-[14rem] truncate font-medium text-slate-800 dark:text-slate-100" title={formatValue(to)}>
                {formatValue(to)}
              </span>
            </>
          ) : (
            <span className="max-w-[18rem] truncate text-slate-700 dark:text-slate-200" title={formatValue(change.action === "deleted" ? from : to)}>
              {formatValue(change.action === "deleted" ? from : to)}
            </span>
          )}
        </div>
      ))}
      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="self-start text-xs font-semibold text-[#0078D7] hover:underline dark:text-blue-400"
        >
          {expanded ? "Show less" : `+${hidden} more`}
        </button>
      ) : null}
      {change.note ? <div className="text-xs italic text-slate-500 dark:text-slate-400">{change.note}</div> : null}
      {!entries.length && !change.note ? <span className="text-xs text-slate-400 dark:text-slate-500">-</span> : null}
    </div>
  );
}

function ChangeActor({ change }) {
  const { actor, source, ip_address: ip } = change;
  const name = actor?.name || actor?.email;
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-slate-800 dark:text-white">{name || "Anonymous"}</div>
      {actor?.name && actor?.email ? (
        <div className="truncate text-xs text-slate-500 dark:text-slate-400" title={actor.email}>
          {actor.email}
        </div>
      ) : null}
      {!name && ip ? <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{ip}</div> : null}
      <div className="mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
        via {SOURCE_LABELS[source] || source}
      </div>
    </div>
  );
}

// Traceability of KPI and target allocation changes: what, when, by whom.
export default function KpiChangeLog() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search while typing, without a request per key.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get("/api/admin/kpi-changes", {
        params: { limit: 300, entity_type: entityType || undefined, action: action || undefined, search: query || undefined },
      })
      .then((res) => {
        if (cancelled) return;
        setChanges(res.data?.changes || []);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Unable to load the KPI audit trail."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, action, query]);

  const filtered = Boolean(entityType || action || query);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search a KPI, unit or person"
          label="Search the changes"
          className="w-full sm:w-72"
        />
        <SelectMenu
          icon={DashboardIcon}
          label="Type"
          value={entityType}
          options={TYPE_OPTIONS}
          onChange={setEntityType}
          active={Boolean(entityType)}
        />
        <SelectMenu
          icon={ActivityIcon}
          label="Action"
          value={action}
          options={ACTION_OPTIONS}
          onChange={setAction}
          active={Boolean(action)}
        />
        {entityType || action || search ? (
          <ClearFiltersButton
            onClick={() => {
              setEntityType("");
              setAction("");
              setSearch("");
            }}
          />
        ) : null}
        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">Latest 300 changes</span>
      </div>

      {error ? <div className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</div> : null}
      {!error && loading ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : null}
      {!error && !loading && !changes.length ? (
        <div className="p-5">
          <EmptyState>
            {filtered
              ? "No change matches these filters."
              : "No KPI or target allocation change yet. Changes made in the Responsible KPI Dashboard, the KPI admin page and the target approvals will appear here."}
          </EmptyState>
        </div>
      ) : null}

      {!error && !loading && changes.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-2.5">When</th>
                <th className="px-5 py-2.5">Change</th>
                <th className="px-5 py-2.5">Item</th>
                <th className="px-5 py-2.5">Details</th>
                <th className="px-5 py-2.5">By</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => {
                const meta = ACTION_META[change.action] || { label: change.action, tone: "slate" };
                return (
                  <tr key={change.change_id} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                      {formatDateTime(change.created_at, "-")}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {change.entity_type === "kpi" ? "KPI" : "Target allocation"}
                      </div>
                    </td>
                    <td className="max-w-xs px-5 py-3">
                      <div className="font-semibold text-slate-800 dark:text-white">{change.label || "-"}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {change.owner?.full_name ? `${change.owner.full_name} · ` : ""}
                        <span className="font-mono">#{change.entity_id}</span>
                      </div>
                    </td>
                    <td className="min-w-[16rem] px-5 py-3">
                      <ChangeDetails change={change} />
                    </td>
                    <td className="max-w-[16rem] px-5 py-3">
                      <ChangeActor change={change} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

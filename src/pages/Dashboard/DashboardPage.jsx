import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";
import BoardTitle from "../../components/BoardTitle.jsx";
import { DashboardIcon } from "../../components/icons.jsx";

// Data source: GET /api/responsibles/:id/dashboard, a JSON port of the
// original GET /dashboard page's exact SQL (ranked_results over kpi_result +
// kpi_target_allocation + kpi, latest row per allocation per calendar month)
// and month-grouping logic. The backend already returns months pre-grouped;
// this file just renders them and recomputes lightweight per-KPI status.

const PERCENT_UNIT_PATTERN = /^(%|percent|percentage)$/i;

function isPercentageUnit(unit) {
  return PERCENT_UNIT_PATTERN.test(String(unit || "").trim());
}

function normalizeMetricNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[^\d.+-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMetricValue(value, unit) {
  const numeric = normalizeMetricNumber(value);
  if (numeric === null) return "Not filled";
  const formatted = numeric.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: isPercentageUnit(unit) ? 1 : 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatTimestamp(value) {
  if (!value) return "No updates recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No updates recorded";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Mirrors the original getDashboardSubmissionStatus's outcome for the
// summary counters: no value -> "missing", otherwise anything short of an
// explicit "below target" reading counts as on-track.
function getSubmissionStatus(kpi) {
  const value = normalizeMetricNumber(kpi.value);
  if (value === null) {
    return { hasValue: false, isGood: null };
  }
  const target = normalizeMetricNumber(kpi.target);
  if (target === null) {
    return { hasValue: true, isGood: null };
  }
  const isGood = kpi.target_direction === "Down" ? value <= target : value >= target;
  return { hasValue: true, isGood };
}

function buildKpiFormUrl({ responsibleId, week }) {
  const params = new URLSearchParams();
  if (responsibleId) params.set("responsible_id", String(responsibleId));
  if (week) params.set("week", week);
  const query = params.toString();
  return query ? `/form?${query}` : "/form";
}

function sanitizeReturnUrl(value) {
  if (!value || !value.startsWith("/form") || value.startsWith("//")) return null;
  return value;
}

function StatusChip({ status }) {
  const label = !status.hasValue ? "Pending update" : status.isGood === false ? "Needs attention" : "On track";
  const className = !status.hasValue
    ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
    : status.isGood === false
      ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/30"
      : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-100 dark:border-green-500/30";
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${className}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

function KpiCard({ kpi }) {
  const status = getSubmissionStatus(kpi);
  const valueClass = !status.hasValue ? "text-slate-400 dark:text-slate-500" : status.isGood === false ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{kpi.subject || "-"}</h3>
          <p className="mt-1 text-sm italic text-slate-400 dark:text-slate-500">{kpi.indicator_sub_title || "No KPI subtitle provided."}</p>
        </div>
        <StatusChip status={status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Actual</div>
          <div className={`mt-1.5 text-xl font-bold ${valueClass}`}>{formatMetricValue(kpi.value, kpi.unit)}</div>
        </div>
        {normalizeMetricNumber(kpi.target) !== null && (
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Target</div>
            <div className="mt-1.5 text-xl font-bold text-green-600 dark:text-green-400">{formatMetricValue(kpi.target, kpi.unit)}</div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-400 dark:text-slate-500">
        <span>Last updated: {formatTimestamp(kpi.updated_at)}</span>
        <span>{kpi.frequency || ""}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const responsibleId = searchParams.get("responsible_id");
  const requestedReturnUrl = sanitizeReturnUrl(searchParams.get("return_url"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responsible, setResponsible] = useState(null);
  const [monthGroups, setMonthGroups] = useState([]);
  const [serverKpiFormUrl, setServerKpiFormUrl] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState("");

  useEffect(() => {
    if (!responsibleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    apiClient
      .get(`/api/responsibles/${responsibleId}/dashboard`)
      .then((res) => {
        if (cancelled) return;
        setResponsible(res.data.responsible || null);
        setMonthGroups(
          (res.data.months || []).map((month) => ({ ...month, items: month.kpis || [] }))
        );
        setServerKpiFormUrl(res.data.kpi_form_url || "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || "Failed to load dashboard data.");
        setResponsible(null);
        setMonthGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [responsibleId]);

  const activeMonthKey = selectedMonthKey || monthGroups[0]?.monthKey || "";
  const activeMonth = monthGroups.find((month) => month.monthKey === activeMonthKey) || monthGroups[0] || null;

  const kpiFormUrl = requestedReturnUrl || serverKpiFormUrl || buildKpiFormUrl({ responsibleId });

  if (!responsibleId) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-6 text-center text-sm font-semibold text-red-600 dark:text-red-400">
          Missing responsible_id
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400 dark:text-slate-500">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500 dark:text-red-400">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-[1120px] p-6">
      <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-blue-800 to-blue-600 px-9 py-8 text-white">
        <BoardTitle
          inverse
          icon={DashboardIcon}
          eyebrow="KPI Performance Center"
          title={`${responsible?.name || `Person #${responsibleId}`} Dashboard`}
          subtitle="Review KPI snapshots by month, focus on the latest performance picture, and switch between archived views without leaving the page."
        />
      </div>

      <div className="rounded-b-3xl border border-t-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xl">
        <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white dark:from-slate-900 to-slate-50 dark:to-slate-900 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Responsible</div>
            <div className="mt-2 text-lg font-bold text-slate-800 dark:text-white">{responsible?.name || "-"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white dark:from-slate-900 to-slate-50 dark:to-slate-900 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Group</div>
            <div className="mt-2 text-lg font-bold text-slate-800 dark:text-white">{responsible?.plant_name || ""}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white dark:from-slate-900 to-slate-50 dark:to-slate-900 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Department</div>
            <div className="mt-2 text-lg font-bold text-slate-800 dark:text-white">{responsible?.department_name || "-"}</div>
          </div>
        </div>

        <div className="mb-5 flex justify-end">
          <Link
            to={kpiFormUrl}
            className="inline-flex min-h-[48px] items-center justify-center rounded-2xl btn-brand px-5 text-sm font-bold shadow-lg transition hover:-translate-y-0.5"
          >
            Back to KPI Form
          </Link>
        </div>

        {monthGroups.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-10 text-center text-slate-400 dark:text-slate-500">
            No KPI data available yet.
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Monthly View</div>
                <div className="mt-1 text-xl font-bold text-slate-800 dark:text-white">Filter KPI snapshots by month</div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Use the selector to focus on one reporting month at a time. The dashboard summary below updates instantly to match your selection.
                </p>
              </div>
              <label className="flex min-w-[260px] flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Select month</span>
                <select
                  className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white shadow-sm outline-none focus:border-blue-400"
                  value={activeMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                >
                  {monthGroups.map((month) => (
                    <option key={month.monthKey} value={month.monthKey}>
                      {month.monthLabel}
                      {month.isLatest ? " - Latest" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeMonth && (
              <section className="mb-6 rounded-2xl border border-blue-100 dark:border-blue-500/30 bg-gradient-to-br from-blue-50/70 dark:from-blue-500/10 to-blue-50/40 dark:to-blue-500/10 p-6">
                <div className="mb-2 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Current Selection
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">{activeMonth.monthLabel}</h2>
                <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                  Showing the KPI snapshot recorded for {activeMonth.monthLabel}.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">KPI Cards</div>
                    <div className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-white">{activeMonth.kpiCount}</div>
                    <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Total KPI snapshots in this month</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Needs Attention</div>
                    <div className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-white">{activeMonth.alertCount}</div>
                    <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Submitted KPI cards currently shown in red</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">On Track</div>
                    <div className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-white">{activeMonth.onTrackCount}</div>
                    <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Submitted KPI cards currently shown in green</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Last Update</div>
                    <div className="mt-1.5 text-lg font-bold text-slate-800 dark:text-white">{activeMonth.lastUpdated}</div>
                    <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Most recent KPI update stored for this month</div>
                  </div>
                </div>
              </section>
            )}

            {activeMonth && (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-5">
                <div className="mb-4 flex items-center gap-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-600 text-sm font-extrabold text-white">
                    {activeMonth.monthShort}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{activeMonth.monthLabel}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {activeMonth.kpiCount} KPI snapshot{activeMonth.kpiCount !== 1 ? "s" : ""} recorded for this view
                    </p>
                  </div>
                </div>
                <div className="grid gap-3.5">
                  {activeMonth.items.map((kpi) => (
                    <KpiCard key={kpi.kpi_target_allocation_id || kpi.kpi_id} kpi={kpi} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

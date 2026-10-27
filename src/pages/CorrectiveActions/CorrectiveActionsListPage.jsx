import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";
import BoardTitle from "../../components/BoardTitle.jsx";
import { TargetIcon } from "../../components/icons.jsx";

// Data source note: the original GET /corrective-actions-list queried
// public."Responsible"/"Plant"/"Department" and public.corrective_actions --
// all confirmed absent from the current database (information_schema), so
// that page has thrown on every request since before this migration (same
// legacy-table pattern already documented for /dashboard-history and
// /kpi-trends). This page instead calls the new
// GET /api/responsibles/:id/corrective-actions, which reads from the real,
// currently-live corrective-action store (the separate Action Plan
// database) via the already-used loadActionPlanCorrectiveActionMaps helper.

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(action) {
  if (!action.due_date || ["Closed", "Completed"].includes(action.status)) return false;
  const due = new Date(action.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

const STATUS_CLASSES = {
  Open: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Waiting for validation": "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Completed: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300",
  Closed: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

function ActionCard({ action, responsibleId }) {
  const overdue = isOverdue(action);
  const kpi = action.kpi || {};
  const currentVal = kpi.current_value !== null && kpi.current_value !== undefined ? parseFloat(kpi.current_value) : null;
  const targetVal = kpi.target !== null && kpi.target !== undefined ? parseFloat(kpi.target) : null;
  const gap = currentVal !== null && targetVal !== null && !Number.isNaN(currentVal) && !Number.isNaN(targetVal)
    ? (targetVal - currentVal).toFixed(2)
    : "—";

  return (
    <div className={`rounded-2xl border bg-white dark:bg-slate-900 p-5 shadow-sm ${overdue ? "border-red-300 dark:border-red-500/50" : "border-slate-200 dark:border-slate-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-800 dark:text-white">{kpi.subject || "KPI"}</div>
          {kpi.indicator_sub_title && <div className="text-xs text-slate-400 dark:text-slate-500">{kpi.indicator_sub_title}</div>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASSES[action.status] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
          {action.status || "Open"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Current</div>
          <div className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{kpi.current_value ?? "—"} {kpi.unit || ""}</div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Target</div>
          <div className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{kpi.target ?? "—"} {kpi.unit || ""}</div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Gap</div>
          <div className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{gap} {kpi.unit || ""}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <span className="block text-slate-400 dark:text-slate-500">Week</span>
          <strong className="text-slate-700 dark:text-slate-200">{action.week}</strong>
        </div>
        <div>
          <span className="block text-slate-400 dark:text-slate-500">Responsible</span>
          <strong className="text-slate-700 dark:text-slate-200">{action.responsible || "—"}</strong>
        </div>
        <div>
          <span className="block text-slate-400 dark:text-slate-500">Due Date</span>
          <strong className={overdue ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}>{formatDate(action.due_date)}</strong>
        </div>
        <div>
          <span className="block text-slate-400 dark:text-slate-500">Estimated Days</span>
          <strong className="text-slate-700 dark:text-slate-200">{action.estimated_duration_days ?? "—"}</strong>
        </div>
        <div>
          <span className="block text-slate-400 dark:text-slate-500">Importance</span>
          <strong className="text-slate-700 dark:text-slate-200">{action.importance || "—"}</strong>
        </div>
        <div>
          <span className="block text-slate-400 dark:text-slate-500">Urgency</span>
          <strong className="text-slate-700 dark:text-slate-200">{action.urgency || "—"}</strong>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5">
        <span className={`text-xs font-semibold ${overdue ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}`}>
          {action.due_date ? (overdue ? "⛔ Overdue" : "📅 Due date set") : "🕒 No due date"}
        </span>
        <Link
          to={`/corrective-action-form?responsible_id=${encodeURIComponent(responsibleId)}&kpi_id=${encodeURIComponent(kpi.kpi_id || action.kpi_id)}&week=${encodeURIComponent(action.week)}&corrective_action_id=${encodeURIComponent(action.corrective_action_id)}`}
          className="rounded-xl btn-brand px-4 py-2 text-xs font-bold shadow-sm"
        >
          {action.status === "Open" ? "Complete Action" : "View Corrective Action"}
        </Link>
      </div>
    </div>
  );
}

export default function CorrectiveActionsListPage() {
  const [searchParams] = useSearchParams();
  const responsibleId = searchParams.get("responsible_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actions, setActions] = useState([]);

  useEffect(() => {
    if (!responsibleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    apiClient
      .get(`/api/responsibles/${responsibleId}/corrective-actions`)
      .then((res) => {
        if (cancelled) return;
        setActions(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || "Failed to load corrective actions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [responsibleId]);

  if (!responsibleId) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-6 text-center text-sm font-semibold text-red-600 dark:text-red-400">
          Missing responsible_id
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-950 to-blue-700 p-7 text-white shadow-lg">
        <BoardTitle
          inverse
          icon={TargetIcon}
          eyebrow="Action plan"
          title="Corrective Actions"
          subtitle="Open corrective actions assigned to this responsible."
        />
      </div>

      {loading && <div className="p-14 text-center text-slate-400 dark:text-slate-500">Loading corrective actions...</div>}
      {!loading && error && <div className="p-14 text-center text-red-500 dark:text-red-400">{error}</div>}

      {!loading && !error && actions.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 text-center">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No corrective actions found</h3>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">This responsible does not have corrective actions yet.</p>
        </div>
      )}

      {!loading && !error && actions.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {actions.map((action) => (
            <ActionCard key={action.corrective_action_id} action={action} responsibleId={responsibleId} />
          ))}
        </div>
      )}
    </div>
  );
}

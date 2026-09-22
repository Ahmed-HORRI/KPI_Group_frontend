import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";

// Data source note: the original GET /corrective-actions-bulk queried
// public."Responsible"/"Plant"/"Department" and public.corrective_actions --
// all confirmed absent from the current database (same dead legacy-table
// pattern documented for /corrective-actions-list). This page instead
// filters the new GET /api/responsibles/:id/corrective-actions list down to
// this week's still-"Open" actions (the original's own WHERE status='Open'
// filter, excluding actions already moved to "Waiting for validation").
// Submission uses the fixed POST /api/corrective-actions/submit-bulk (see
// backend commit 56831de).

const IMPORTANCE_OPTIONS = ["High", "Medium", "Low"];
const URGENCY_OPTIONS = ["Flexible", "Urgent", "Secondary"];

export default function CorrectiveActionsBulkPage() {
  const [searchParams] = useSearchParams();
  const responsibleId = searchParams.get("responsible_id");
  const week = searchParams.get("week");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actions, setActions] = useState([]);
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [completedCount, setCompletedCount] = useState(null);

  useEffect(() => {
    if (!responsibleId || !week) {
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
        const openThisWeek = (Array.isArray(res.data) ? res.data : []).filter(
          (a) => a.week === week && a.status === "Open"
        );
        setActions(openThisWeek);
        setForms(
          Object.fromEntries(
            openThisWeek.map((a) => [
              a.corrective_action_id,
              {
                root_cause: a.root_cause || "",
                implemented_solution: a.implemented_solution || "",
                due_date: a.due_date || "",
                estimated_duration_days: a.estimated_duration_days ?? "",
                responsible: a.responsible || "",
                importance: a.importance || "",
                urgency: a.urgency || "",
              },
            ])
          )
        );
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
  }, [responsibleId, week]);

  const updateField = (actionId, field, value) =>
    setForms((prev) => ({ ...prev, [actionId]: { ...prev[actionId], [field]: value } }));

  const submitAll = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const res = await apiClient.post("/api/corrective-actions/submit-bulk", {
        responsible_id: responsibleId,
        week,
        actions: actions.map((a) => ({ corrective_action_id: a.corrective_action_id, ...forms[a.corrective_action_id] })),
      });
      setCompletedCount(res.data.completed_count ?? 0);
    } catch (err) {
      setSaveError(err.response?.data?.error || "Could not save corrective actions.");
    } finally {
      setSaving(false);
    }
  };

  if (!responsibleId || !week) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-600">
          Missing responsible_id or week
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading corrective actions...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500">{error}</div>;
  }

  if (completedCount !== null) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center p-6">
        <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-green-600">All Corrective Actions Submitted!</h1>
          <div className="my-5 text-5xl font-extrabold text-green-600">{completedCount}</div>
          <p className="text-sm text-slate-500">
            You have successfully submitted all corrective actions for week {week}.<br />
            The quality team will review your submissions.
          </p>
          <Link
            to={`/corrective-actions-list?responsible_id=${encodeURIComponent(responsibleId)}`}
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg"
          >
            View Corrective Actions
          </Link>
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center p-6">
        <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
          <h2 className="text-2xl font-bold text-green-600">No Open Corrective Actions</h2>
          <p className="mt-2 text-sm text-slate-500">All corrective actions for week {week} have been completed.</p>
          <Link
            to={`/dashboard?responsible_id=${encodeURIComponent(responsibleId)}`}
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-700 p-7 text-white shadow-lg">
        <h1 className="text-3xl font-extrabold">Bulk Corrective Actions — Week {week}</h1>
        <p className="mt-1.5 text-sm text-white/80">Complete all open corrective actions for this week in one go.</p>
      </div>

      {saveError && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{saveError}</div>}

      <form onSubmit={submitAll} className="flex flex-col gap-6">
        {actions.map((action, index) => {
          const form = forms[action.corrective_action_id] || {};
          const kpi = action.kpi || {};
          const currentVal = kpi.current_value !== null && kpi.current_value !== undefined ? parseFloat(kpi.current_value) : null;
          const targetVal = kpi.target !== null && kpi.target !== undefined ? parseFloat(kpi.target) : null;
          const gap = currentVal !== null && targetVal !== null ? (targetVal - currentVal).toFixed(2) : null;

          return (
            <div key={action.corrective_action_id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="font-bold text-slate-800">{kpi.subject || "KPI"}</div>
                  {kpi.indicator_sub_title && <div className="text-xs text-slate-400">{kpi.indicator_sub_title}</div>}
                </div>
              </div>

              <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Current Value</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{kpi.current_value || "0"} {kpi.unit || ""}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Target</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{kpi.target || "N/A"} {kpi.unit || ""}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Gap</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{gap ?? "N/A"} {kpi.unit || ""}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold text-slate-600">Due Date</span>
                  <input
                    type="date"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    value={form.due_date}
                    onChange={(e) => updateField(action.corrective_action_id, "due_date", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold text-slate-600">Responsible</span>
                  <input
                    type="text"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    value={form.responsible}
                    onChange={(e) => updateField(action.corrective_action_id, "responsible", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold text-slate-600">Estimated Days</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    value={form.estimated_duration_days}
                    onChange={(e) => updateField(action.corrective_action_id, "estimated_duration_days", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold text-slate-600">Importance</span>
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    value={form.importance}
                    onChange={(e) => updateField(action.corrective_action_id, "importance", e.target.value)}
                  >
                    <option value="">Select importance</option>
                    {IMPORTANCE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold text-slate-600">Urgency</span>
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    value={form.urgency}
                    onChange={(e) => updateField(action.corrective_action_id, "urgency", e.target.value)}
                  >
                    <option value="">Select urgency</option>
                    {URGENCY_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-slate-600">Root Cause</span>
                <textarea
                  className="min-h-[80px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  value={form.root_cause}
                  onChange={(e) => updateField(action.corrective_action_id, "root_cause", e.target.value)}
                />
              </label>
              <label className="mt-3 flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-slate-600">Implemented Solution</span>
                <textarea
                  className="min-h-[80px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  value={form.implemented_solution}
                  onChange={(e) => updateField(action.corrective_action_id, "implemented_solution", e.target.value)}
                />
              </label>
            </div>
          );
        })}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit All Corrective Actions"}
        </button>
      </form>
    </div>
  );
}

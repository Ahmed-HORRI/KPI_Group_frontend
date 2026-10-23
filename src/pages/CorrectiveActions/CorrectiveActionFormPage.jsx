import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";

const IMPORTANCE_OPTIONS = ["High", "Medium", "Low"];
const URGENCY_OPTIONS = ["Flexible", "Urgent", "Secondary"];

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

const STATUS_BADGE_CLASSES = {
  Open: "bg-red-50 text-red-700 border-red-200",
  "Waiting for validation": "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-green-50 text-green-700 border-green-200",
  Closed: "bg-green-50 text-green-700 border-green-200",
};

export default function CorrectiveActionFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const responsibleId = searchParams.get("responsible_id");
  const kpiId = searchParams.get("kpi_id");
  const week = searchParams.get("week");
  const correctiveActionId = searchParams.get("corrective_action_id");
  const isNewAction = searchParams.get("new_action") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responsible, setResponsible] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [existing, setExisting] = useState(null);

  const [form, setForm] = useState({
    due_date: defaultDueDate(),
    responsible: "",
    estimated_duration_days: "",
    importance: "",
    urgency: "",
    root_cause: "",
    implemented_solution: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!responsibleId || !kpiId || !week) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      apiClient.get(`/api/responsibles/${responsibleId}/dashboard`),
      apiClient.get(`/api/responsibles/${responsibleId}/corrective-actions`),
    ])
      .then(([dashboardRes, actionsRes]) => {
        if (cancelled) return;
        setResponsible(dashboardRes.data.responsible || null);

        const allKpis = (dashboardRes.data.months || []).flatMap((month) => month.kpis || []);
        const foundKpi = allKpis.find((row) => String(row.kpi_id) === String(kpiId)) || null;
        setKpi(foundKpi);

        const actions = Array.isArray(actionsRes.data) ? actionsRes.data : [];
        let matched = null;
        if (correctiveActionId) {
          matched = actions.find((a) => String(a.corrective_action_id) === String(correctiveActionId)) || null;
        } else if (!isNewAction) {
          matched = actions
            .filter((a) => String(a.kpi_id) === String(kpiId) && a.week === week)
            .sort((a, b) => new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0))[0] || null;
        }
        setExisting(matched);
        setForm({
          due_date: matched?.due_date || defaultDueDate(),
          responsible: matched?.responsible || dashboardRes.data.responsible?.name || "",
          estimated_duration_days: matched?.estimated_duration_days ?? "",
          importance: matched?.importance || "",
          urgency: matched?.urgency || "",
          root_cause: matched?.root_cause || "",
          implemented_solution: matched?.implemented_solution || "",
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || "Failed to load corrective action.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [responsibleId, kpiId, week, correctiveActionId, isNewAction]);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await apiClient.post("/api/corrective-actions/submit", {
        responsible_id: responsibleId,
        kpi_id: kpiId,
        week,
        corrective_action_id: existing?.corrective_action_id || undefined,
        due_date: form.due_date,
        responsible: form.responsible,
        estimated_duration_days: form.estimated_duration_days,
        importance: form.importance,
        urgency: form.urgency,
        root_cause: form.root_cause,
        implemented_solution: form.implemented_solution,
        status: existing?.status,
      });
      navigate(`/corrective-actions-list?responsible_id=${encodeURIComponent(responsibleId)}`);
    } catch (err) {
      setSaveError(err.response?.data?.error || "Could not save corrective action");
    } finally {
      setSaving(false);
    }
  };

  if (!responsibleId || !kpiId || !week) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-600">
          Missing responsible_id, kpi_id, or week
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading corrective action...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500">{error}</div>;
  }

  const actionTitle = existing?.corrective_action_id
    ? `Corrective Action #${existing.corrective_action_id}`
    : "New Corrective Action";
  const submitLabel = existing?.corrective_action_id ? "Update Corrective Action" : "Create Corrective Action";

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-gradient-to-br from-red-700 to-red-500 p-8 text-white">
          <h1 className="text-3xl font-extrabold">{actionTitle}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/90">
            <span><strong>Week:</strong> {week}</span>
            <span><strong>Responsible:</strong> {responsible?.name || "—"}</span>
            <span><strong>Plant:</strong> {responsible?.plant_name || "—"}</span>
            <span><strong>Department:</strong> {responsible?.department_name || "—"}</span>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 grid grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">KPI</span>
              <strong className="text-sm text-slate-800">{kpi?.subject || "—"}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">Subtitle</span>
              <strong className="text-sm text-slate-800">{kpi?.indicator_sub_title || "—"}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">Current Value</span>
              <strong className="text-sm text-slate-800">{kpi?.value ?? "—"} {kpi?.unit || ""}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">Target</span>
              <strong className="text-sm text-slate-800">{kpi?.target ?? "—"} {kpi?.unit || ""}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">Low Limit</span>
              <strong className="text-sm text-slate-800">{kpi?.low_limit ?? "—"} {kpi?.unit || ""}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">High Limit</span>
              <strong className="text-sm text-slate-800">{kpi?.high_limit ?? "—"} {kpi?.unit || ""}</strong>
            </div>
          </div>

          <div className="mb-6">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold ${STATUS_BADGE_CLASSES[existing?.status] || "bg-red-50 text-red-700 border-red-200"}`}>
              Status: {existing?.status || "Open"}
            </span>
          </div>

          <h2 className="mb-4 text-xl font-bold text-red-700">Action Details</h2>

          {saveError && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{saveError}</div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold text-slate-700">📅 Due Date *</span>
                <input
                  type="date"
                  required
                  className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={form.due_date}
                  onChange={(e) => updateField("due_date", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold text-slate-700">👤 Responsible *</span>
                <input
                  type="text"
                  required
                  className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={form.responsible}
                  onChange={(e) => updateField("responsible", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold text-slate-700">Estimated Duration (Days) *</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={form.estimated_duration_days}
                  onChange={(e) => updateField("estimated_duration_days", e.target.value)}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold text-slate-700">Importance *</span>
                <select
                  required
                  className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={form.importance}
                  onChange={(e) => updateField("importance", e.target.value)}
                >
                  <option value="">Select importance</option>
                  {IMPORTANCE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-bold text-slate-700">Urgency *</span>
                <select
                  required
                  className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={form.urgency}
                  onChange={(e) => updateField("urgency", e.target.value)}
                >
                  <option value="">Select urgency</option>
                  {URGENCY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-bold text-slate-700">🔍 Root Cause Analysis *</span>
              <textarea
                required
                className="min-h-[120px] rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                value={form.root_cause}
                onChange={(e) => updateField("root_cause", e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-bold text-slate-700">🔧 Implemented Solution *</span>
              <textarea
                required
                className="min-h-[120px] rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                value={form.implemented_solution}
                onChange={(e) => updateField("implemented_solution", e.target.value)}
              />
            </label>

            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl btn-brand px-6 py-3 text-sm font-bold shadow-lg"
              >
                {saving ? "Saving..." : submitLabel}
              </button>
              <Link
                to={`/corrective-action-form?responsible_id=${encodeURIComponent(responsibleId)}&kpi_id=${encodeURIComponent(kpiId)}&week=${encodeURIComponent(week)}&new_action=1`}
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600"
              >
                Add New Action
              </Link>
              <Link
                to={`/corrective-actions-list?responsible_id=${encodeURIComponent(responsibleId)}`}
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600"
              >
                Back to Corrective Actions
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

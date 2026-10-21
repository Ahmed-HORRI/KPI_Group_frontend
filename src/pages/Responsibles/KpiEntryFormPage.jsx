import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";
import KpiEntryFormCard from "./components/KpiEntryFormCard";
import KpiEntryFormAssistant from "./components/KpiEntryFormAssistant";
import { isCompleteCorrectiveAction, isOutOfTarget } from "./kpiEntryFormUtils";

// React rebuild of the original GET /form page (index.js:31820-38601, the
// largest single route of the monolith): the weekly/monthly KPI value entry
// form for one responsible.
//
// Data comes from the new GET /api/responsibles/:id/kpi-form (backend commit
// 97a4f86), which mirrors the original's 6 SQL queries and its server-side
// derivation. Submission uses the already-verified
// POST /api/responsibles/:id/kpi-results instead of the original's
// misleadingly named POST /redirect (which returned an HTML page, not a
// redirect).
//
// Query parameters, same defaults as the original:
//   responsible_id  required; without it the page cannot resolve a person
//   week            defaults server-side to getCurrentFormWeek() (Friday
//                   cut-over) or, when `frequency` is given, to that
//                   frequency's current target period
//   frequency       canonicalised, filters the KPI list and drives the
//                   daily/weekly/monthly period mode
//   calculation_mode  filters the KPI list (default "direct" server-side)
//   unit_id         filters COALESCE(kta.unit_id, kta.plant_id)
//   return_url      where the confirmation screen links back to; only /form
//                   URLs are accepted (sanitizeKpiFormReturnUrl)
//
// Deliberately not reproduced from the original page (all confirmed dead or
// broken there): the inert checkLowLimit() panel toggling, the unreachable
// "All KPIs" assistant mode (#assistantLauncher was never rendered), the
// .ca-ai-card suggestion feature (markup only exists on
// /corrective-actions-bulk), collectAssistantKpis()/showToast()/
// runCorrectiveActionPopupCheck() (never called), the duplicated
// showSimpleCaRequiredModal declarations, the never-registered
// kpiBarFlowLinePlugin, the .kpi-chart-trigger click handler killed by
// `pointer-events:none`, the duplicated `input` listeners on every value
// field, and the 30s chart polling interval that was never cleared.
// One real bug is fixed rather than reproduced: the original rendered no
// hidden `unit_id` input, so the unit scope was silently dropped on submit
// even though the receiving handler read it; it is submitted here.
export default function KpiEntryFormPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const responsibleId = searchParams.get("responsible_id");
  const weekParam = searchParams.get("week");
  const frequencyParam = searchParams.get("frequency");
  const calculationModeParam = searchParams.get("calculation_mode");
  const unitIdParam = searchParams.get("unit_id");
  const returnUrlParam = searchParams.get("return_url");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [comments, setComments] = useState({});
  const [actionsByKpi, setActionsByKpi] = useState({});
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);
  const [assistantKpi, setAssistantKpi] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFeedback, setHelpFeedback] = useState("");
  const [helpStatus, setHelpStatus] = useState("");

  useEffect(() => {
    if (!responsibleId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    apiClient
      .get(`/api/responsibles/${responsibleId}/kpi-form`, {
        params: {
          week: weekParam || undefined,
          frequency: frequencyParam || undefined,
          calculation_mode: calculationModeParam || undefined,
          unit_id: unitIdParam || undefined,
          return_url: returnUrlParam || undefined,
        },
      })
      .then((res) => {
        if (cancelled) return;
        const payload = res.data;
        setData(payload);
        setValues(
          Object.fromEntries(
            (payload.kpis || []).map((kpi) => [
              kpi.allocation_id,
              kpi.value === null || kpi.value === undefined ? "" : String(kpi.value),
            ])
          )
        );
        setComments(
          Object.fromEntries((payload.kpis || []).map((kpi) => [kpi.allocation_id, kpi.comment || ""]))
        );
        setActionsByKpi(
          Object.fromEntries(
            (payload.kpis || []).map((kpi) => [kpi.allocation_id, kpi.current_actions || []])
          )
        );
        setTouched(false);
        setResult(null);
        setSubmitError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || "Failed to load the KPI entry form.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [responsibleId, weekParam, frequencyParam, calculationModeParam, unitIdParam, returnUrlParam]);

  const kpis = useMemo(() => data?.kpis || [], [data]);
  const correctiveActionsEnabled = Boolean(data?.corrective_actions_enabled);
  // Temporary (KPI_FORM_REQUIRE_CORRECTIVE_ACTION on the backend): corrective
  // actions stay optional until the target allocation limits are fixed.
  const correctiveActionsRequired =
    correctiveActionsEnabled && Boolean(data?.corrective_actions_required);

  // Same gate the original applied in updateSubmitButtonState(): every value
  // must be filled, and -- when corrective actions are required -- every KPI
  // outside its limits must carry a corrective action with a root cause, a
  // solution, a due date and an owner.
  const blockingKpis = useMemo(
    () =>
      kpis.filter((kpi) => {
        const rawValue = values[kpi.allocation_id];
        if (String(rawValue ?? "").trim() === "") return true;
        if (!correctiveActionsRequired) return false;
        if (!isOutOfTarget(rawValue, kpi.low_limit, kpi.high_limit, kpi.good_direction)) return false;
        return !(actionsByKpi[kpi.allocation_id] || []).some(isCompleteCorrectiveAction);
      }),
    [kpis, values, actionsByKpi, correctiveActionsRequired]
  );

  const handleStatusChange = useCallback((correctiveActionId, nextStatus) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        kpis: current.kpis.map((kpi) => ({
          ...kpi,
          history_actions: (kpi.history_actions || []).map((action) =>
            action.corrective_action_id === correctiveActionId
              ? { ...action, status: nextStatus }
              : action
          ),
        })),
      };
    });
  }, []);

  const changePeriod = (nextPeriod) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("week", nextPeriod);
    setSearchParams(nextParams);
  };

  const openConfirm = () => {
    setTouched(true);
    if (blockingKpis.length > 0) return;
    setConfirmOpen(true);
  };

  const submit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError("");
    try {
      const items = kpis
        .filter((kpi) => String(values[kpi.allocation_id] ?? "").trim() !== "")
        .map((kpi) => ({
          allocation_id: kpi.allocation_id,
          value: Number(values[kpi.allocation_id]),
          comment: comments[kpi.allocation_id] || null,
          corrective_actions: (actionsByKpi[kpi.allocation_id] || []).map((action) => ({
            corrective_action_id: action.corrective_action_id || null,
            root_cause: action.root_cause || null,
            implemented_solution: action.implemented_solution || null,
            due_date: action.due_date || null,
            estimated_duration_days:
              String(action.estimated_duration_days ?? "").trim() === ""
                ? null
                : Number(action.estimated_duration_days),
            responsible_name: action.responsible || null,
            importance: action.importance || null,
            urgency: action.urgency || null,
            status: action.status || null,
          })),
        }));

      const res = await apiClient.post(`/api/responsibles/${responsibleId}/kpi-results`, {
        week: data.period.week,
        calculation_mode: data.calculation_mode,
        frequency: data.frequency,
        unit_id: data.unit_id,
        return_url: data.return_url,
        items,
      });
      setResult(res.data);
    } catch (err) {
      setSubmitError(err.response?.data?.error || "Could not save the KPI values.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendHelpFeedback = async () => {
    if (!helpFeedback.trim()) {
      setHelpStatus("Feedback is required.");
      return;
    }
    setHelpStatus("Sending...");
    try {
      await apiClient.post("/api/help-support", {
        feedback: helpFeedback,
        page: window.location.href,
        name: data?.responsible?.name || "",
        group: data?.responsible?.group || "",
        role: data?.responsible?.role || "",
        week: data?.period?.label || "",
      });
      setHelpStatus("Thanks — your feedback was sent.");
      setHelpFeedback("");
    } catch (err) {
      setHelpStatus(err.response?.data?.message || "Could not send the feedback.");
    }
  };

  if (!responsibleId) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-600">
          Missing responsible_id
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading KPI form...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500">{error}</div>;
  }

  if (result) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center p-6">
        <div className="w-full rounded-3xl bg-white p-10 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-green-600">KPI Values Submitted</h1>
          <p className="mt-1 text-sm text-slate-500">Period {result.week}</p>
          <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-2 text-left">
            {(result.notifications || []).map((notification, index) => (
              <li
                key={index}
                className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                {notification}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {result.form_url && (
              <Link
                to={result.form_url}
                onClick={() => setResult(null)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600"
              >
                Back to the form
              </Link>
            )}
            {result.dashboard_url && (
              <Link
                to={result.dashboard_url}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const responsible = data?.responsible || {};
  const period = data?.period || { options: [] };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="rounded-2xl bg-white px-8 py-6 text-sm font-bold text-slate-700 shadow-2xl">
            Submitting KPI Values...
          </div>
        </div>
      )}

      <div className="mb-6 rounded-2xl bg-[#0078D7] p-6 text-white shadow-lg">
        <h1 className="text-2xl font-extrabold">KPI Submission — {period.label}</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Name</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{responsible.name || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Group</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{responsible.group || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Role</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{responsible.role || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {period.title}
          </div>
          <select
            value={period.label}
            onChange={(event) => changePeriod(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
          >
            {(period.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Frequency
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800">{data?.frequency}</div>
        </div>
      </div>

      {kpis.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">No KPI values to enter yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            This form only shows KPI target allocations whose owner is this responsible. No target
            allocation is currently assigned to them for this period, frequency and scope.
          </p>
          <Link
            to={`/dashboard?responsible_id=${encodeURIComponent(responsibleId)}`}
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#0078D7]/80 pb-2">
            <h2 className="text-lg font-bold text-[#0078D7]">KPI Values ({kpis.length})</h2>
            <button
              type="button"
              onClick={() => setHelpOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#0ea5f5] to-[#0078D7] px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:-translate-y-0.5"
            >
              📍 Help Support
            </button>
          </div>

          {helpOpen && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-slate-700">Help Support</div>
              <p className="mt-1 text-xs text-slate-500">
                Describe the problem you are facing on this page — it is emailed to the KPI support
                team with your name, group, role and period.
              </p>
              <textarea
                value={helpFeedback}
                onChange={(event) => setHelpFeedback(event.target.value)}
                className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendHelpFeedback}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Send
                </button>
                {helpStatus && <span className="text-xs text-slate-500">{helpStatus}</span>}
              </div>
            </div>
          )}

          {submitError && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex flex-col gap-5">
            {kpis.map((kpi) => (
              <KpiEntryFormCard
                key={kpi.allocation_id}
                kpi={kpi}
                value={values[kpi.allocation_id]}
                comment={comments[kpi.allocation_id]}
                actions={actionsByKpi[kpi.allocation_id] || []}
                touched={touched}
                correctiveActionsEnabled={correctiveActionsEnabled}
                correctiveActionsRequired={correctiveActionsRequired}
                defaultResponsible={data?.default_responsible || ""}
                periodHeading={period.title}
                onValueChange={(next) =>
                  setValues((current) => ({ ...current, [kpi.allocation_id]: next }))
                }
                onCommentChange={(next) =>
                  setComments((current) => ({ ...current, [kpi.allocation_id]: next }))
                }
                onActionsChange={(next) =>
                  setActionsByKpi((current) => ({ ...current, [kpi.allocation_id]: next }))
                }
                onStatusChange={handleStatusChange}
                onOpenAssistant={() => setAssistantKpi(kpi)}
              />
            ))}
          </div>

          <div className="sticky bottom-0 mt-6 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            {touched && blockingKpis.length > 0 && (
              <div className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700">
                {blockingKpis.length} KPI{blockingKpis.length > 1 ? "s" : ""} still need a value or a
                complete corrective action.
              </div>
            )}
            <button
              type="button"
              onClick={openConfirm}
              disabled={submitting || (touched && blockingKpis.length > 0)}
              className="w-full rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
            >
              Submit KPI Values
            </button>
          </div>
        </>
      )}

      <datalist id="kpi-entry-form-responsibles">
        {(data?.responsible_options || []).map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800">Confirm Submission</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to submit your KPI values?
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {assistantKpi && (
        <KpiEntryFormAssistant
          kpi={assistantKpi}
          responsibleId={responsibleId}
          onClose={() => setAssistantKpi(null)}
        />
      )}
    </div>
  );
}

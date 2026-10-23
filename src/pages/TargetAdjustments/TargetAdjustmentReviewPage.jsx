import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";

// Mirrors the monolith's getKpiTargetAdjustmentReasonLabelEnglish() (index.js).
function getReasonLabel(reason) {
  if (reason === "three_consecutive_periods_and_five_percent") {
    return "3 consecutive improved periods and at least 5% improvement";
  }
  if (reason === "three_consecutive_periods") {
    return "3 consecutive improved periods";
  }
  return "At least 5% improvement in the current period";
}

// Mirrors the monolith's getPeopleDisplayName() (src/models/kpi.model.js).
function getDisplayName(firstName, name) {
  const first = (firstName || "").trim();
  const full = (name || "").trim();
  if (first && full && first !== full) return `${first} ${full}`;
  return full || first || null;
}

function statusBadgeClasses(status) {
  if (status === "Pending approval") return "bg-amber-50 text-amber-700";
  if (status === "Approved") return "bg-green-50 text-green-700";
  return "bg-red-50 text-red-700";
}

export default function TargetAdjustmentReviewPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [comment, setComment] = useState("");
  const [lowLimit, setLowLimit] = useState("");
  const [highLimit, setHighLimit] = useState("");
  const [submitting, setSubmitting] = useState(null); // "approve" | "reject" | null
  const [outcome, setOutcome] = useState(null); // { proposal, message, error }

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoadError("Cette proposition n'existe pas ou le lien n'est plus valide.");
      setLoading(false);
      return;
    }
    setLoading(true);
    apiClient
      .get("/api/kpi-target-adjustments/proposal", { params: { token } })
      .then((res) => {
        if (cancelled) return;
        const loaded = res.data?.proposal || null;
        setProposal(loaded);
        setLowLimit(loaded?.current_low_limit ?? "");
        setHighLimit(loaded?.current_high_limit ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err.response?.data?.error ||
            "Cette proposition n'existe pas ou le lien n'est plus valide."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading proposal...</div>;
  }

  if (loadError && !proposal) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <h1 className="text-xl font-extrabold text-slate-900">Invalid link</h1>
          <p className="mt-3 text-sm text-slate-500">{loadError}</p>
        </div>
      </div>
    );
  }

  const activeProposal = outcome ? outcome.proposal || proposal : proposal;
  const isAbsolute = String(activeProposal?.tolerance_type || "").trim().toLowerCase() === "absolute";
  const isPending = !outcome && activeProposal?.status === "Pending approval";
  const directionLabel = activeProposal?.target_direction === "down" ? "Lower is better" : "Higher is better";
  const responsibleName =
    getDisplayName(activeProposal?.responsible_first_name, activeProposal?.responsible_name) || "N/A";
  const evidence = Array.isArray(activeProposal?.evidence) ? activeProposal.evidence : [];
  const message = outcome?.message || "";
  const messageIsError = Boolean(outcome?.error);

  const submitDecision = async (action) => {
    setSubmitting(action);
    try {
      const res = await apiClient.post("/api/kpi-target-adjustments/decision", {
        token,
        action,
        decision_comment: comment || null,
        low_limit: isAbsolute ? lowLimit || null : null,
        high_limit: isAbsolute ? highLimit || null : null,
      });
      setOutcome(res.data);
    } catch (err) {
      if (err.response?.data) {
        setOutcome(err.response.data);
      } else {
        setOutcome({
          proposal: null,
          message: "The decision could not be recorded.",
          error: true,
        });
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="h-2 bg-gradient-to-r from-teal-500 to-blue-500" />
        <div className="p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {activeProposal?.kpi_name || "KPI"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">Target adjustment proposal</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${statusBadgeClasses(
                activeProposal?.status
              )}`}
            >
              {activeProposal?.status || "Unknown"}
            </span>
          </div>

          {message && (
            <div
              className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
                messageIsError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs text-slate-500">Current target</span>
              <strong className="mt-1 block text-xl text-slate-800">
                {activeProposal?.previous_target_value} {activeProposal?.target_unit || ""}
              </strong>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <span className="text-xs text-teal-700">Proposed target</span>
              <strong className="mt-1 block text-xl text-teal-800">
                {activeProposal?.proposed_target_value} {activeProposal?.target_unit || ""}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs text-slate-500">Direction</span>
              <strong className="mt-1 block text-base text-slate-800">{directionLabel}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs text-slate-500">Responsible</span>
              <strong className="mt-1 block text-base text-slate-800">{responsibleName}</strong>
            </div>
          </div>

          <p className="mt-5 text-sm text-slate-600">
            <strong className="font-bold text-slate-800">Reason: </strong>
            {getReasonLabel(activeProposal?.trigger_reason)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            <strong className="font-bold text-slate-800">Improvement: </strong>
            {activeProposal?.improvement_percentage === null || activeProposal?.improvement_percentage === undefined
              ? "Not calculable"
              : `${activeProposal.improvement_percentage}%`}
          </p>

          {evidence.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-bold text-slate-800">Analyzed values</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="border-b border-slate-100 py-2">Period</th>
                    <th className="border-b border-slate-100 py-2">Actual value</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.map((entry, index) => (
                    <tr key={index}>
                      <td className="border-b border-slate-50 py-2 text-slate-600">{entry.period_label || "—"}</td>
                      <td className="border-b border-slate-50 py-2 text-slate-600">{entry.actual_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isPending ? (
            <div className="mt-6 border-t border-slate-100 pt-5">
              {isAbsolute ? (
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold text-slate-600">Low Limit</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      type="number"
                      step="any"
                      required
                      value={lowLimit}
                      onChange={(e) => setLowLimit(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold text-slate-600">High Limit</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      type="number"
                      step="any"
                      required
                      value={highLimit}
                      onChange={(e) => setHighLimit(e.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Relative limits will be recalculated automatically after approval.
                </p>
              )}

              <label className="mt-4 flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-slate-600">Manager comment</span>
                <textarea
                  className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="Decision reason or comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>

              <div className="mt-5 flex gap-3">
                <button
                  className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
                  onClick={() => submitDecision("reject")}
                  disabled={submitting !== null || (isAbsolute && (lowLimit === "" || highLimit === ""))}
                >
                  {submitting === "reject" ? "Rejecting..." : "Reject"}
                </button>
                <button
                  className="flex-1 rounded-xl btn-brand px-4 py-3 text-sm font-bold shadow-lg transition hover:-translate-y-0.5"
                  onClick={() => submitDecision("approve")}
                  disabled={submitting !== null || (isAbsolute && (lowLimit === "" || highLimit === ""))}
                >
                  {submitting === "approve" ? "Approving..." : "Approve the new target"}
                </button>
              </div>
            </div>
          ) : (
            !message && (
              <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">
                This proposal has already been processed.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

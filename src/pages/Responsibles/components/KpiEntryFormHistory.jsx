import { useState } from "react";
import apiClient from "../../../api/client";
import { CA_STATUS_OPTIONS, formatTimestamp } from "../kpiEntryFormUtils";

// Corrective-action history + manager-comment history for one KPI.
//
// The original showed both through the same #historyModal (openHistoryModal /
// openCommentsHistoryModal wrote into #historyModalContent). Here they are two
// collapsible panels on the card itself -- same columns, same data, no modal
// state machine. The status <select> still writes through the real
// POST /api/corrective-actions/:id/status endpoint, and still asks for
// confirmation before closing an action, exactly like
// handleHistoryStatusChange did.

const statusClasses = {
  Open: "bg-amber-50 text-amber-700",
  "Waiting for validation": "bg-blue-50 text-blue-700",
  Completed: "bg-green-50 text-green-700",
  Closed: "bg-slate-100 text-slate-500",
};

function HistoryActionsTable({ actions, periodHeading, onStatusChange }) {
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState("");

  const changeStatus = async (action, nextStatus) => {
    if (nextStatus === action.status) return;
    if (nextStatus === "Closed") {
      const confirmed = window.confirm(
        "Close this corrective action? It will no longer appear as an open action."
      );
      if (!confirmed) return;
    }

    setPendingId(action.corrective_action_id);
    setError("");
    try {
      await apiClient.post(`/api/corrective-actions/${action.corrective_action_id}/status`, {
        status: nextStatus,
      });
      onStatusChange(action.corrective_action_id, nextStatus);
    } catch (err) {
      setError(err.response?.data?.error || "Could not update the corrective action status.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      {error && (
        <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}
      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <th className="px-2 py-2">{periodHeading}</th>
            <th className="px-2 py-2">Root Cause</th>
            <th className="px-2 py-2">Implemented Solution</th>
            <th className="px-2 py-2">Due Date</th>
            <th className="px-2 py-2">Est. Days</th>
            <th className="px-2 py-2">Importance</th>
            <th className="px-2 py-2">Urgency</th>
            <th className="px-2 py-2">Responsible</th>
            <th className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <tr key={action.corrective_action_id} className="border-b border-slate-100 align-top">
              <td className="px-2 py-2 font-semibold text-slate-600">{action.week || "—"}</td>
              <td className="px-2 py-2 text-slate-600">{action.root_cause || "—"}</td>
              <td className="px-2 py-2 text-slate-600">{action.implemented_solution || "—"}</td>
              <td className="px-2 py-2 text-slate-600">{action.due_date || "—"}</td>
              <td className="px-2 py-2 text-slate-600">{action.estimated_duration_days ?? "—"}</td>
              <td className="px-2 py-2 text-slate-600">{action.importance || "—"}</td>
              <td className="px-2 py-2 text-slate-600">{action.urgency || "—"}</td>
              <td className="px-2 py-2 text-slate-600">{action.responsible || "—"}</td>
              <td className="px-2 py-2">
                <select
                  disabled={pendingId === action.corrective_action_id}
                  value={action.status || "Open"}
                  onChange={(event) => changeStatus(action, event.target.value)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold outline-none ${
                    statusClasses[action.status] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {CA_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KpiEntryFormHistory({
  kpi,
  periodHeading,
  correctiveActionsEnabled,
  onStatusChange,
}) {
  const [openPanel, setOpenPanel] = useState(null);

  const historyActions = kpi.history_actions || [];
  const historyComments = kpi.history_comments || [];
  const hasHistory =
    (correctiveActionsEnabled && historyActions.length > 0) || historyComments.length > 0;

  if (!hasHistory) return null;

  const toggle = (panel) => setOpenPanel((current) => (current === panel ? null : panel));

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {correctiveActionsEnabled && historyActions.length > 0 && (
          <button
            type="button"
            onClick={() => toggle("actions")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {openPanel === "actions" ? "Hide" : "View"} Corrective Action History (
            {historyActions.length})
          </button>
        )}
        {historyComments.length > 0 && (
          <button
            type="button"
            onClick={() => toggle("comments")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {openPanel === "comments" ? "Hide" : "View"} Comment History ({historyComments.length})
          </button>
        )}
      </div>

      {openPanel === "actions" && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <HistoryActionsTable
            actions={historyActions}
            periodHeading={periodHeading}
            onStatusChange={onStatusChange}
          />
        </div>
      )}

      {openPanel === "comments" && (
        <div className="mt-3 flex flex-col gap-2">
          {historyComments.map((comment, index) => (
            <div
              key={`${comment.week}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {comment.week} · {formatTimestamp(comment.updated_at)}
              </div>
              <div className="mt-1 text-sm text-slate-600">{comment.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

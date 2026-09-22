import {
  CA_IMPORTANCE_OPTIONS,
  CA_STATUS_OPTIONS,
  CA_URGENCY_OPTIONS,
  createEmptyCorrectiveAction,
  isCompleteCorrectiveAction,
} from "../kpiEntryFormUtils";

// Inline corrective-action editor for one KPI card.
//
// The original page kept this in a 9-column modal table (#caTableModal) backed
// by an in-memory store that was mirrored back into a permanently hidden
// .ca-actions-stack of real form inputs so the values would be posted with the
// form (syncDomFromStore). React state removes the need for both layers, so
// the editor is inline and the fields map straight onto the
// corrective_actions[] entries of POST /api/responsibles/:id/kpi-results.
//
// The owner picker is a native type-ahead (<input list>) over the active-people
// list instead of the original's custom searchable dropdown portal
// (#caModalResponsibleShell/Trigger/Menu/Search/Options driving a hidden native
// select) -- the list is ~2000 names, so a plain <select> would be unusable.
// The <datalist> itself is rendered once by the page, not per card.

const fieldClass =
  "rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400";

export default function KpiEntryFormCorrectiveActions({
  actions,
  defaultResponsible,
  required,
  onChange,
}) {
  const updateAction = (index, field, value) => {
    onChange(actions.map((action, i) => (i === index ? { ...action, [field]: value } : action)));
  };

  const addAction = () => onChange([...actions, createEmptyCorrectiveAction(defaultResponsible)]);

  const removeAction = (index) => onChange(actions.filter((_, i) => i !== index));

  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${
        required ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-700">Corrective Actions</div>
          <div className="text-xs text-slate-500">
            {required
              ? "This KPI is outside its limits — a complete corrective action is required before submitting."
              : "Optional for this KPI this period."}
          </div>
        </div>
        <button
          type="button"
          onClick={addAction}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
        >
          + Add Action
        </button>
      </div>

      {actions.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-400">
          No corrective action for this period yet.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {actions.map((action, index) => {
          const complete = isCompleteCorrectiveAction(action);
          return (
            <div
              key={action.corrective_action_id || `new-${index}`}
              className={`rounded-xl border bg-white p-3 ${
                required && !complete ? "border-red-300" : "border-slate-200"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Action {index + 1}
                  {action.corrective_action_id ? ` · #${action.corrective_action_id}` : " · new"}
                </span>
                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">Due Date{required ? " *" : ""}</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={action.due_date || ""}
                    onChange={(event) => updateAction(index, "due_date", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">
                    Responsible / Owner{required ? " *" : ""}
                  </span>
                  <input
                    list="kpi-entry-form-responsibles"
                    className={fieldClass}
                    placeholder="Choose action owner"
                    value={action.responsible || ""}
                    onChange={(event) => updateAction(index, "responsible", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">Est. Days{required ? " *" : ""}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Days"
                    className={fieldClass}
                    value={action.estimated_duration_days ?? ""}
                    onChange={(event) =>
                      updateAction(index, "estimated_duration_days", event.target.value)
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">Importance</span>
                  <select
                    className={fieldClass}
                    value={action.importance || ""}
                    onChange={(event) => updateAction(index, "importance", event.target.value)}
                  >
                    <option value="">Select importance</option>
                    {CA_IMPORTANCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">Urgency</span>
                  <select
                    className={fieldClass}
                    value={action.urgency || ""}
                    onChange={(event) => updateAction(index, "urgency", event.target.value)}
                  >
                    <option value="">Select urgency</option>
                    {CA_URGENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">Status</span>
                  <select
                    className={fieldClass}
                    value={action.status || "Open"}
                    onChange={(event) => updateAction(index, "status", event.target.value)}
                  >
                    {CA_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 flex flex-col gap-1 text-xs">
                <span className="font-semibold text-slate-600">Root Cause{required ? " *" : ""}</span>
                <textarea
                  className={`${fieldClass} min-h-[64px]`}
                  placeholder="Describe the root cause..."
                  value={action.root_cause || ""}
                  onChange={(event) => updateAction(index, "root_cause", event.target.value)}
                />
              </label>
              <label className="mt-2 flex flex-col gap-1 text-xs">
                <span className="font-semibold text-slate-600">
                  Immediate Action / Solution{required ? " *" : ""}
                </span>
                <textarea
                  className={`${fieldClass} min-h-[64px]`}
                  placeholder="Describe the implemented solution..."
                  value={action.implemented_solution || ""}
                  onChange={(event) =>
                    updateAction(index, "implemented_solution", event.target.value)
                  }
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

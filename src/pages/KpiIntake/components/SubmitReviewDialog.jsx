import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../../api/client";
import Dialog, { buttonClasses, Spinner } from "../../../components/Dialog.jsx";
import { AlertIcon, CheckCircleIcon, SendIcon } from "../../../components/icons.jsx";
import StatusChip from "./StatusChip.jsx";

const SECTIONS = [
  { entityType: "kpi", title: "KPIs", noun: "KPI" },
  { entityType: "target_allocation", title: "Target allocations", noun: "Allocation" },
];

// "Target: 10 → 12", one line per changed cell of a row of the database.
function ChangeList({ changes }) {
  return (
    <ul className="mt-1.5 space-y-0.5 text-xs">
      {changes.map((change) => (
        <li key={change.key} className="flex min-w-0 flex-wrap gap-x-1.5">
          <span className="shrink-0 text-slate-400">{change.label}:</span>
          <span className="text-slate-500 line-through decoration-slate-300">{change.from ?? "empty"}</span>
          <span className="text-slate-400">→</span>
          <span className="font-semibold text-slate-800">{change.to ?? "empty"}</span>
        </li>
      ))}
    </ul>
  );
}

function LineReview({ line, noun, checked, onToggle, disabled }) {
  const errors = Object.entries(line.errors || {});
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 px-3.5 py-2.5">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0078D7]"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          aria-label={`Select line ${line.intake_id}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={line.status} />
            {line.record_id ? (
              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">
                Change · {noun} #{line.record_id}
              </span>
            ) : (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">New</span>
            )}
            <span className="truncate text-sm font-semibold text-slate-900">{line.label}</span>
            <span className="text-xs text-slate-400">
              #{line.intake_id}
              {line.submitted_by_name ? ` · ${line.submitted_by_name.split(" — ")[0]}` : ""}
            </span>
          </div>
          {line.record_id && line.changes?.length ? <ChangeList changes={line.changes} /> : null}
          {line.duplicate?.message ? <p className="mt-1 text-xs text-amber-700">{line.duplicate.message}</p> : null}
          {errors.length ? (
            <ul className="mt-1 space-y-0.5 text-xs text-red-600">
              {errors.map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          ) : null}
          <details className="mt-1.5 text-xs">
            <summary className="cursor-pointer select-none font-semibold text-slate-500 hover:text-slate-700">
              {line.record_id ? "The whole row after the change" : "Values as understood"} ({line.resolved.length})
            </summary>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {line.resolved.map((cell) => (
                <div key={cell.key} className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-slate-400">{cell.label}</dt>
                  <dd className="min-w-0 truncate text-slate-700" title={String(cell.value)}>
                    {String(cell.value)}
                    {cell.id ? <span className="ml-1 font-mono text-[11px] text-blue-600">id {cell.id}</span> : null}
                    {cell.intake_id ? (
                      <span className="ml-1 font-mono text-[11px] text-violet-600">line #{cell.intake_id}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </div>
    </li>
  );
}

const count = (items, word) => `${items.length} ${word}${items.length === 1 ? "" : "s"}`;

function SubmitResult({ result }) {
  const { created, skipped } = result;
  const updated = result.updated || { kpi: [], target_allocation: [] };
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-emerald-900">
        <CheckCircleIcon size={18} className="mt-0.5 shrink-0" />
        <p>
          Created: {count(created.kpi, "KPI")} and {count(created.target_allocation, "target allocation")}. Changed:{" "}
          {count(updated.kpi, "KPI")} and {count(updated.target_allocation, "target allocation")}.
        </p>
      </div>
      {[
        ["KPIs created", created.kpi, (item) => `KPI id ${item.kpi_id}`],
        ["KPIs changed", updated.kpi, (item) => `KPI id ${item.kpi_id}`],
        ["Target allocations created", created.target_allocation, (item) => `allocation id ${item.kpi_target_allocation_id}`],
        ["Target allocations changed", updated.target_allocation, (item) => `allocation id ${item.kpi_target_allocation_id}`],
      ].map(([title, items, describe]) =>
        items.length ? (
          <div key={title}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
            <ul className="mt-1.5 space-y-1">
              {items.map((item) => (
                <li key={item.intake_id} className="rounded-lg bg-slate-50 px-3 py-1.5">
                  <div className="flex justify-between gap-3">
                    <span className="truncate text-slate-800">{item.label}</span>
                    <span className="shrink-0 font-mono text-xs text-blue-700">{describe(item)}</span>
                  </div>
                  {item.changes?.length ? <ChangeList changes={item.changes} /> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null
      )}
      {skipped.length ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Not submitted</h3>
          <ul className="mt-1.5 space-y-1 text-amber-800">
            {skipped.map((item) => (
              <li key={item.intake_id}>
                Line #{item.intake_id}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// Administrators: every waiting line as the server understands it (names ->
// ids, duplicates), then the submit of the selected ready lines into the KPI
// tables, or their rejection.
export default function SubmitReviewDialog({ hasUnsavedLines, onClose, onChanged }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/api/admin/kpi-intake/preview");
      setReport(res.data);
      setSelected(
        new Set(
          [...res.data.kpi, ...res.data.target_allocation].filter((line) => line.status === "pending").map((line) => line.intake_id)
        )
      );
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Unable to check the lines."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allLines = useMemo(() => (report ? [...report.kpi, ...report.target_allocation] : []), [report]);
  const selectedLines = allLines.filter((line) => selected.has(line.intake_id));
  const selectedReady = selectedLines.filter((line) => line.status === "pending");

  const toggle = (intakeId) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(intakeId)) next.delete(intakeId);
      else next.add(intakeId);
      return next;
    });

  const setSection = (lines, checked) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const line of lines) {
        if (checked) next.add(line.intake_id);
        else next.delete(line.intake_id);
      }
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await apiClient.post("/api/admin/kpi-intake/submit", {
        intake_ids: selectedReady.map((line) => line.intake_id),
      });
      setResult(res.data);
      onChanged();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "The lines could not be submitted. Nothing was saved."));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.post("/api/admin/kpi-intake/reject", {
        intake_ids: selectedLines.map((line) => line.intake_id),
        comment,
      });
      setRejecting(false);
      setComment("");
      onChanged();
      await load();
    } catch (rejectError) {
      setError(getApiErrorMessage(rejectError, "The lines could not be rejected."));
    } finally {
      setBusy(false);
    }
  };

  const footer = result ? (
    <button type="button" className={buttonClasses.primary} onClick={onClose} data-autofocus>
      Close
    </button>
  ) : rejecting ? (
    <>
      <button type="button" className={buttonClasses.secondary} onClick={() => setRejecting(false)} disabled={busy}>
        Back
      </button>
      <button type="button" className={buttonClasses.danger} onClick={reject} disabled={busy || !selectedLines.length}>
        {busy ? <Spinner /> : null}
        Reject {selectedLines.length} line{selectedLines.length === 1 ? "" : "s"}
      </button>
    </>
  ) : (
    <>
      <button type="button" className={buttonClasses.secondary} onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button
        type="button"
        className={buttonClasses.secondary}
        onClick={() => setRejecting(true)}
        disabled={busy || loading || !selectedLines.length}
      >
        Reject selected…
      </button>
      <button type="button" className={buttonClasses.primary} onClick={submit} disabled={busy || loading || !selectedReady.length}>
        {busy ? <Spinner /> : <SendIcon size={16} />}
        Submit {selectedReady.length} ready line{selectedReady.length === 1 ? "" : "s"}
      </button>
    </>
  );

  return (
    <Dialog
      title={result ? "Lines submitted" : "Review and submit"}
      subtitle={
        result
          ? "The lines are now in the KPI tables. The others stay on the page."
          : "Ready lines are written to the KPI and target allocation tables: KPIs first, then allocations. A change writes only the cells listed. Duplicates and lines with errors are never written."
      }
      icon={result ? CheckCircleIcon : SendIcon}
      tone={result ? "success" : "brand"}
      size="xl"
      busy={busy}
      onClose={onClose}
      footer={footer}
      footerHint={
        !result && !rejecting && selectedLines.length > selectedReady.length
          ? "Only ready lines are submitted; select duplicates or lines to fix to reject them."
          : null
      }
    >
      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-800">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <SubmitResult result={result} />
      ) : loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Spinner /> Checking every line…
        </div>
      ) : report ? (
        <div className="space-y-6">
          {hasUnsavedLines ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              This page has unsaved lines: they are not part of this review. Save them first to include them.
            </div>
          ) : null}
          {rejecting ? (
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Comment for the responsibles (optional)</span>
              <textarea
                data-autofocus
                value={comment}
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Why these lines are rejected"
              />
            </label>
          ) : null}
          {SECTIONS.map(({ entityType, title, noun }) => {
            const lines = report[entityType];
            const counts = report.counts[entityType];
            const sectionChecked = lines.length > 0 && lines.every((line) => selected.has(line.intake_id));
            return (
              <section key={entityType}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {title}{" "}
                    <span className="font-medium text-slate-500">
                      · {counts.ready} ready · {counts.duplicate} duplicate{counts.duplicate === 1 ? "" : "s"} · {counts.error} to fix
                    </span>
                  </h3>
                  {lines.length ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-[#0078D7]"
                        checked={sectionChecked}
                        onChange={(event) => setSection(lines, event.target.checked)}
                        disabled={busy}
                      />
                      Select all
                    </label>
                  ) : null}
                </div>
                {lines.length ? (
                  <ul className="mt-2 space-y-2">
                    {lines.map((line) => (
                      <LineReview
                        key={line.intake_id}
                        line={line}
                        noun={noun}
                        checked={selected.has(line.intake_id)}
                        onToggle={() => toggle(line.intake_id)}
                        disabled={busy}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500">No line waiting.</p>
                )}
              </section>
            );
          })}
        </div>
      ) : null}
    </Dialog>
  );
}

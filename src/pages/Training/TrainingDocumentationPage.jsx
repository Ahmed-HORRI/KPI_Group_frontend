import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";
import { getDocumentationBlocks, sanitizeTrainingHtml, stripAnswerRevealLines } from "./trainingContentUtils";

const DOC_FRAME_STYLE = `
  body { margin:0; padding:32px; font-family: Arial, Helvetica, sans-serif; color:#1e293b; line-height:1.72; }
  body > *:first-child { margin-top: 0 !important; }
  h1,h2,h3,h4 { color:#0f172a; line-height:1.25; }
  p, li, td, th { color:#334155; font-size:14px; }
  table { width:100%; border-collapse:collapse; background:#fff; }
  td,th { padding:10px 12px; border:1px solid #e2e8f0; }
  img, video, iframe { max-width:100%; }
`;

export default function TrainingDocumentationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const peopleId = searchParams.get("people_id");
  const preferredResultId = searchParams.get("result_id");

  const [portal, setPortal] = useState(null);
  const [activeResultId, setActiveResultId] = useState(preferredResultId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!peopleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    apiClient
      .get("/api/kpi-training/portal", { params: { people_id: peopleId } })
      .then((res) => {
        if (cancelled) return;
        setPortal(res.data);
        const assignments = res.data.assignments || [];
        const next =
          preferredResultId && assignments.some((a) => String(a.result_id) === String(preferredResultId))
            ? String(preferredResultId)
            : res.data.active_result_id
              ? String(res.data.active_result_id)
              : assignments[0]
                ? String(assignments[0].result_id)
                : null;
        setActiveResultId(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || "Could not open the documentation workspace.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleId]);

  const assignments = portal?.assignments || [];
  const person = portal?.people || assignments[0]?.responsible || {};
  const activeAssignment = useMemo(
    () => assignments.find((a) => String(a.result_id) === String(activeResultId)) || assignments[0] || null,
    [assignments, activeResultId]
  );

  const selectAssignment = (resultId) => {
    setActiveResultId(String(resultId));
    const next = new URLSearchParams(searchParams);
    next.set("people_id", peopleId);
    next.set("result_id", String(resultId));
    setSearchParams(next, { replace: true });
  };

  if (!peopleId) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">Open the documentation workspace with a responsible id</h1>
        <p className="mt-3 text-sm text-slate-500">
          This page reads assigned training rows and opens the documentation content for a specific responsible.
        </p>
        <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 font-mono text-xs text-slate-600">
          /kpi-training-documentation?people_id=123&amp;result_id=456
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-10 text-center text-slate-400">Loading assigned documentation...</div>;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">We could not open the documentation workspace</h1>
        <p className="mt-3 text-sm text-red-500">{error}</p>
      </div>
    );
  }
  if (!assignments.length || !activeAssignment) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">No training documentation found</h1>
        <p className="mt-3 text-sm text-slate-500">
          {person.name || "This responsible"} does not currently have a training assignment that can be opened here.
        </p>
      </div>
    );
  }

  const safeHtml = sanitizeTrainingHtml(activeAssignment.training.html);
  const hasFormattedDocumentation = Boolean(safeHtml.trim());
  const blocks = getDocumentationBlocks(activeAssignment);
  const note = stripAnswerRevealLines(activeAssignment.training.comments || "");
  const trainingCenterUrl = `/kpi-training-center?people_id=${encodeURIComponent(peopleId)}&result_id=${encodeURIComponent(
    activeAssignment.result_id
  )}`;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">KPI Training Documentation</h1>
          <p className="mt-1 text-sm text-slate-500">Dedicated source-material workspace for training packages.</p>
        </div>
        <a
          href={trainingCenterUrl}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
        >
          Return to Training
        </a>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Responsible</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{person.name || "Responsible"}</div>
            <div className="text-sm text-slate-500">{person.role_name || "Active assignment owner"}</div>
            {person.email && <div className="mt-1 text-xs text-slate-400">{person.email}</div>}
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 py-2">
                <div className="text-lg font-bold text-slate-800">{assignments.length}</div>
                <div className="text-xs text-slate-500">Assignments</div>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <div className="text-lg font-bold text-slate-800">
                  {assignments.filter((a) => a.progress.training_completed).length}
                </div>
                <div className="text-xs text-slate-500">Completed</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Documentation Packages</div>
            <div className="flex flex-col gap-2">
              {assignments.map((a) => (
                <button
                  key={a.result_id}
                  type="button"
                  onClick={() => selectAssignment(a.result_id)}
                  className={`rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                    String(a.result_id) === String(activeAssignment.result_id)
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="font-bold text-slate-800">{a.training.name}</div>
                  <div className="text-xs text-slate-500">{a.kpi.name}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {a.training.html_available
                      ? "Formatted documentation available"
                      : `${a.training.block_count} structured block${a.training.block_count === 1 ? "" : "s"}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex flex-col gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Dedicated Documentation</span>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Training Documentation</h2>
            <p className="mt-2 text-sm text-slate-500">
              Review the source documentation in its own interface, then return to the training workspace when you are
              ready to confirm completion or continue to the QCM.
            </p>
          </div>

          {note && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              <strong className="block font-bold">Trainer note</strong>
              {note}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Documentation View</div>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Source material</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {hasFormattedDocumentation ? "Isolated document frame" : "Structured document mode"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Answer keys hidden</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {blocks.length} documentation block{blocks.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {hasFormattedDocumentation ? (
              <iframe
                title="Training documentation"
                sandbox=""
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${DOC_FRAME_STYLE}</style></head><body>${safeHtml}</body></html>`}
                className="h-[560px] w-full rounded-xl border border-slate-200"
              />
            ) : blocks.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {blocks.map((block) => (
                  <article key={block.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <h4 className="text-sm font-bold text-slate-800">{block.title}</h4>
                    {block.body && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{block.body}</p>}
                    {block.bullets.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {block.bullets.map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                No formatted HTML document was available for this training and no documentation-only structured blocks
                were found.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

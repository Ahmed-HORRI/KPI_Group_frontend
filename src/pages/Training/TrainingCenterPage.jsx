import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";
import {
  getStatusLabel,
  getStatusBadgeClass,
  formatDateTime,
  stripAnswerRevealLines,
  sanitizeTrainingBlock,
  getChoiceBadge,
  getQuestionGuidance,
  removeQuestionsSection,
} from "./trainingContentUtils";

function StepStrip({ assignment }) {
  const cards = [
    {
      title: "1. Assigned",
      copy: assignment.training_sent_at
        ? `Sent ${formatDateTime(assignment.training_sent_at)}`
        : "Assignment is visible in the responsible queue.",
      done: Boolean(assignment.training_sent_at),
      current: !assignment.progress.training_completed,
    },
    {
      title: "2. Training",
      copy: assignment.progress.training_completed
        ? `Completed ${formatDateTime(assignment.training_completed_at)}`
        : "Read the content and confirm the learning step.",
      done: assignment.progress.training_completed,
      current: assignment.progress.training_completed && !assignment.progress.test_completed,
    },
    {
      title: "3. Assessment",
      copy: assignment.test.available
        ? assignment.progress.test_completed
          ? `Submitted ${formatDateTime(assignment.test_completed_at)}`
          : assignment.progress.test_sent
            ? "Questionnaire is unlocked and ready."
            : "Questionnaire unlocks after the training step."
        : "No questionnaire is linked to this training.",
      done: assignment.progress.test_completed,
      current: assignment.test.available && assignment.progress.training_completed && !assignment.progress.test_completed,
    },
    {
      title: "4. Outcome",
      copy: assignment.progress.test_completed
        ? `${assignment.passed ? "Passed" : "Needs follow-up"} at ${assignment.score}%`
        : "Final outcome is created after submission.",
      done: assignment.progress.test_completed,
      current: assignment.progress.test_completed,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-xl border p-3 text-xs ${
            card.done
              ? "border-green-200 bg-green-50"
              : card.current
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-white"
          }`}
        >
          <strong className="block text-slate-800">{card.title}</strong>
          <span className="mt-1 block leading-snug text-slate-500">{card.copy}</span>
        </div>
      ))}
    </div>
  );
}

function DocumentationPanel({ assignment }) {
  const blocks = useMemo(
    () =>
      (assignment.training.blocks || [])
        .map((block) => sanitizeTrainingBlock(block))
        .filter((block) => block.title || block.body || block.bullets.length),
    [assignment]
  );
  const note = stripAnswerRevealLines(assignment.training.comments || "");
  const rawHtml = assignment.training.html_available ? removeQuestionsSection(assignment.training.html || "") : "";
  const hasHtml = Boolean(rawHtml.trim());

  return (
    <section id={`doc-${assignment.result_id}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Documentation</div>
          <h3 className="mt-1 text-lg font-bold text-slate-900">{assignment.training.name}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Read the full documentation first. When you reach the end, use "Move to quizzes" below to unlock the QCM.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(assignment.status)}`}>
          {getStatusLabel(assignment.status)}
        </span>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
        <strong className="block font-bold">Documentation first</strong>
        The quiz stays hidden until you confirm the documentation has been reviewed. Correct answers are removed from the
        training material before it is shown here.
      </div>

      {note && <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{note}</div>}

      {hasHtml ? (
        <iframe
          title={`Training documentation ${assignment.result_id}`}
          srcDoc={rawHtml}
          className="h-[480px] w-full rounded-xl border border-slate-200 bg-white"
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
          No documentation content is available for this assignment yet.
        </div>
      )}
    </section>
  );
}

function QuestionInput({ question, resultId, answers, onChange, disabled }) {
  const selected = answers[question.id] || [];

  if (question.type === "text") {
    return (
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
        value={selected[0] || ""}
        disabled={disabled}
        placeholder="Type the best answer here"
        onChange={(e) => onChange(resultId, question.id, e.target.value, true, "text")}
      />
    );
  }

  const inputType = question.type === "multi" ? "checkbox" : "radio";
  return (
    <div className="grid gap-2">
      {(question.options || []).map((option, index) => {
        const checked = selected.includes(option.key);
        const label = stripAnswerRevealLines(option.label) || `Option ${getChoiceBadge(index)}`;
        return (
          <label
            key={option.key}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${
              checked ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type={inputType}
              name={`question-${resultId}-${question.id}`}
              checked={checked}
              disabled={disabled}
              onChange={(e) => onChange(resultId, question.id, option.key, e.target.checked, question.type)}
            />
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
              {getChoiceBadge(index)}
            </span>
            <span className="text-slate-700">{label}</span>
          </label>
        );
      })}
    </div>
  );
}

function ReviewSection({ assignment }) {
  return (
    <div className="mt-5">
      <div className={`rounded-xl px-4 py-3 text-sm font-bold ${assignment.passed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
        Assessment Completed — Final score: {assignment.score === null ? "-" : `${assignment.score}%`} / Pass threshold:{" "}
        {assignment.test.pass_score}%.
      </div>
      <div className="mt-4 grid gap-3">
        {(assignment.review || []).map((entry, index) => {
          const isCorrect = entry.is_correct === true;
          return (
            <div
              key={entry.question_id || index}
              className={`rounded-xl border p-4 text-sm ${isCorrect ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}
            >
              <strong className="block text-slate-800">{entry.prompt || `Question ${index + 1}`}</strong>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400">Submitted answer</span>
                  <p className="text-slate-600">{(entry.selected_labels || []).join(", ") || "No answer recorded"}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400">Result</span>
                  <p className={isCorrect ? "font-bold text-green-700" : "font-bold text-red-700"}>
                    {isCorrect ? "Accepted" : "To be improved"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssessmentPanel({ assignment, answers, onAnswerChange }) {
  if (!assignment.test.available) {
    return (
      <section id={`quiz-${assignment.result_id}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Assessment</div>
        <h3 className="mt-1 text-lg font-bold text-slate-900">No linked QCM</h3>
        <p className="mt-2 text-sm text-slate-500">This training assignment does not currently reference a questionnaire.</p>
      </section>
    );
  }

  const questions = assignment.test.questions || [];
  const resultAnswers = answers[assignment.result_id] || {};

  return (
    <section id={`quiz-${assignment.result_id}`} className="assessment-form rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Assessment</div>
          <h3 className="mt-1 text-lg font-bold text-slate-900">{assignment.test.name}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Answer without hints — correct answers stay hidden until you submit.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(assignment.status)}`}>
          {getStatusLabel(assignment.status)}
        </span>
      </div>

      {!assignment.progress.test_completed && questions.length > 0 && (
        <div className="grid gap-4">
          {questions.map((question, index) => (
            <article key={question.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <strong className="text-sm text-slate-800">{stripAnswerRevealLines(question.prompt) || `Question ${index + 1}`}</strong>
                  {question.help_text && <p className="mt-1 text-xs text-slate-500">{stripAnswerRevealLines(question.help_text)}</p>}
                  <div className="mt-1 text-xs text-slate-400">{getQuestionGuidance(question)}</div>
                </div>
              </div>
              <QuestionInput
                question={question}
                resultId={assignment.result_id}
                answers={resultAnswers}
                onChange={onAnswerChange}
                disabled={assignment.progress.test_completed}
              />
            </article>
          ))}
        </div>
      )}

      {!assignment.progress.test_completed && !questions.length && (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          No renderable questions were found for this assessment.
        </div>
      )}

      {assignment.progress.test_completed && <ReviewSection assignment={assignment} />}
    </section>
  );
}

export default function TrainingCenterPage() {
  const [searchParams] = useSearchParams();
  const peopleId = searchParams.get("people_id");
  const preferredResultId = searchParams.get("result_id");

  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("docs");
  const [answers, setAnswers] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [flash, setFlash] = useState(null);

  const loadPortal = async () => {
    if (!peopleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/api/kpi-training/portal", { params: { people_id: peopleId } });
      setPortal(res.data);
      setAnswers((prev) => {
        const next = { ...prev };
        (res.data.assignments || []).forEach((assignment) => {
          if (!next[assignment.result_id]) next[assignment.result_id] = {};
        });
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.error || "Could not load the training portal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleId]);

  const assignments = portal?.assignments || [];
  const person = portal?.people || assignments[0]?.responsible || {};

  const handleAnswerChange = (resultId, questionId, value, checked, type) => {
    setAnswers((prev) => {
      const forResult = { ...(prev[resultId] || {}) };
      const current = Array.isArray(forResult[questionId]) ? forResult[questionId] : [];
      let nextValues;
      if (type === "text") nextValues = value ? [value] : [];
      else if (type === "multi") nextValues = checked ? [...new Set([...current, value])] : current.filter((v) => v !== value);
      else nextValues = [value];
      return { ...prev, [resultId]: { ...forResult, [questionId]: nextValues } };
    });
  };

  const validateAssignment = (assignment) => {
    const questions = assignment.test.questions || [];
    const forResult = answers[assignment.result_id] || {};
    const missing = questions.filter((q) => !(Array.isArray(forResult[q.id]) && forResult[q.id].filter(Boolean).length));
    return { valid: missing.length === 0, missingCount: missing.length };
  };

  const handleUnlockAllConfirmed = async () => {
    setConfirmOpen(false);
    setWorking(true);
    setBusyLabel("Unlocking all questionnaires...");
    setFlash(null);
    try {
      for (const assignment of assignments) {
        if (!assignment.progress.training_completed && !assignment.progress.test_completed) {
          await apiClient.post(`/api/kpi-training/results/${assignment.result_id}/training-complete`, {});
        }
      }
      setView("quiz");
      setFlash({ type: "success", message: "All documentation completed. All quizzes are now unlocked." });
    } catch (err) {
      setFlash({ type: "error", message: err.response?.data?.error || "Could not unlock all quizzes." });
    } finally {
      setWorking(false);
      setBusyLabel("");
    }
  };

  const handleSubmitAll = async () => {
    const pending = assignments.filter((a) => a.test.available && !a.progress.test_completed);
    if (!pending.length) {
      setFlash({ type: "error", message: "No quiz is ready to submit." });
      return;
    }
    for (const assignment of pending) {
      const { valid, missingCount } = validateAssignment(assignment);
      if (!valid) {
        setFlash({
          type: "error",
          message: `Please complete all questions for ${assignment.kpi.name}. Missing: ${missingCount}.`,
        });
        document.getElementById(`quiz-${assignment.result_id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    setWorking(true);
    setBusyLabel("Submitting all questionnaires...");
    setFlash(null);
    try {
      for (const assignment of pending) {
        await apiClient.post(`/api/kpi-training/results/${assignment.result_id}/test-submit`, {
          answers: answers[assignment.result_id] || {},
        });
      }
      await loadPortal();
      setFlash({ type: "success", message: "Assessment completed. Review is now displayed below." });
    } catch (err) {
      setFlash({ type: "error", message: err.response?.data?.error || "Could not submit all questionnaires." });
    } finally {
      setWorking(false);
      setBusyLabel("");
    }
  };

  if (!peopleId) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">Open the training center with a responsible id</h1>
        <p className="mt-3 text-sm text-slate-500">
          This page reads assigned training rows, then loads the learning content and the QCM for a specific responsible.
        </p>
        <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 font-mono text-xs text-slate-600">
          /kpi-training-center?people_id=123
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-10 text-center text-slate-400">Loading assigned trainings...</div>;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">We could not open the training workspace</h1>
        <p className="mt-3 text-sm text-red-500">{error}</p>
      </div>
    );
  }
  if (!assignments.length) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">No active training assignments</h1>
        <p className="mt-3 text-sm text-slate-500">
          {person.name || "This responsible"} does not currently have any training assignment that can be displayed here.
        </p>
      </div>
    );
  }

  const completedCount = assignments.filter((a) => a.progress.test_completed).length;
  const activeCount = assignments.length - completedCount;
  const testCount = assignments.filter((a) => a.test.available).length;
  const totalQuestions = assignments.reduce((sum, a) => sum + Number(a.test.question_count || 0), 0);
  const pendingUnlock = assignments.some((a) => !a.progress.training_completed && !a.progress.test_completed);

  return (
    <div className="mx-auto max-w-[1500px] p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">KPI Training Center</h1>
          <p className="mt-1 text-sm text-slate-500">Learn the content, answer independently, and submit with confidence.</p>
        </div>
        {working && <span className="text-sm font-semibold text-blue-600">{busyLabel}</span>}
      </div>

      {flash && (
        <div
          className={`mb-5 rounded-xl px-4 py-3 text-sm font-semibold ${
            flash.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {flash.message}
        </div>
      )}

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
                <div className="text-xs text-slate-500">Assigned</div>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <div className="text-lg font-bold text-slate-800">{completedCount}</div>
                <div className="text-xs text-slate-500">Completed</div>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <div className="text-lg font-bold text-slate-800">{activeCount}</div>
                <div className="text-xs text-slate-500">Active</div>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <div className="text-lg font-bold text-slate-800">{testCount}</div>
                <div className="text-xs text-slate-500">Tests</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Assignments</div>
            <div className="flex flex-col gap-2">
              {assignments.map((assignment) => (
                <button
                  key={assignment.result_id}
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(`${view === "quiz" ? "quiz" : "doc"}-${assignment.result_id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-sm transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-800">{assignment.kpi.name}</div>
                      <div className="text-xs text-slate-500">{assignment.training.name}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${getStatusBadgeClass(assignment.status)}`}>
                      {getStatusLabel(assignment.status)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {assignment.test.question_count} QCM
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex flex-col gap-5">
          {view === "docs" ? (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Training Journey</span>
                <h2 className="mt-1 text-xl font-bold text-slate-900">All assigned KPI trainings</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Review the documentation for every assigned KPI first. After that, move to the quiz section for all
                  assigned KPI tests.
                </p>
                <div className="mt-4 flex flex-wrap gap-4">
                  <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
                    <div className="text-lg font-bold text-slate-800">{assignments.length}</div>
                    <div className="text-xs text-slate-500">Assigned</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
                    <div className="text-lg font-bold text-slate-800">{completedCount}</div>
                    <div className="text-xs text-slate-500">Completed</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
                    <div className="text-lg font-bold text-slate-800">{totalQuestions}</div>
                    <div className="text-xs text-slate-500">QCM</div>
                  </div>
                </div>
              </section>

              <div className="grid gap-5">
                {assignments.map((assignment) => (
                  <div key={assignment.result_id} className="flex flex-col gap-3">
                    <StepStrip assignment={assignment} />
                    <DocumentationPanel assignment={assignment} />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <small className="text-sm text-slate-500">After reading all KPI documentation, unlock the quizzes.</small>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                >
                  {pendingUnlock ? "Move to quizzes for all KPI" : "Go to quizzes"}
                </button>
              </div>
            </>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Assessment</span>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Answer every assigned KPI quiz</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Correct answers stay hidden until you submit. Once all questions are answered, submit all quizzes together.
                </p>
                <button
                  type="button"
                  onClick={() => setView("docs")}
                  className="mt-3 text-sm font-bold text-blue-600 hover:underline"
                >
                  Back to documentation
                </button>
              </section>

              <div className="grid gap-5">
                {assignments.map((assignment) => (
                  <div key={assignment.result_id} className="flex flex-col gap-3">
                    <StepStrip assignment={assignment} />
                    <AssessmentPanel assignment={assignment} answers={answers} onAnswerChange={handleAnswerChange} />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <small className="text-sm text-slate-500">Submit all completed KPI quizzes together.</small>
                <button
                  type="button"
                  disabled={working}
                  onClick={handleSubmitAll}
                  className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                >
                  {working ? "Submitting..." : "Submit all QCM"}
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Move to the quiz section?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This confirms you have reviewed the documentation for every assigned KPI. The quizzes will unlock for all
              assignments.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
                onClick={() => setConfirmOpen(false)}
              >
                Continue Reading
              </button>
              <button
                type="button"
                className="rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg"
                onClick={handleUnlockAllConfirmed}
              >
                Move to Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

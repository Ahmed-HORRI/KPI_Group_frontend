import { useEffect, useMemo, useState } from "react";
import { preconnect, preinit } from "react-dom";
import { useSearchParams } from "react-router-dom";
import apiClient, { getApiErrorMessage } from "../../api/client";
import {
  buildTrainingSteps,
  collectQuizAnswers,
  findUnansweredQuestions,
  formatDate,
  getChoiceBadge,
  getQuestionGuidance,
  getStatusBadgeClass,
  getStatusLabel,
  pickActiveResultId,
  removeQuestionsSection,
  sanitizeTrainingBlock,
  stripAnswerRevealLines,
} from "./trainingContentUtils";

// Same look as the original kpi-training-center.html served by the KPI-Group app: the page
// loads its own typefaces and draws its own background, top bar and panels.
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap";

const PANEL_FRAME = "rounded-3xl border border-slate-200/90";
// Unlike the original page, the panels have no backdrop blur: it does not show through near-opaque
// white, and the quiz panels are thousands of pixels tall.
const PANEL = `${PANEL_FRAME} bg-linear-to-b from-white/95 to-slate-50/90 shadow-[0_22px_54px_rgba(15,23,42,0.07)]`;
const SECTION_TITLE = "text-[11px] font-extrabold uppercase tracking-[0.72px] text-slate-500";
const METRIC_LABEL = "block text-[10px] font-extrabold uppercase tracking-[0.68px]";
const EYEBROW =
  "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/15 px-[11px] py-1.5 text-[10px] font-extrabold uppercase tracking-[0.7px] text-white";
const STATE_BOX = "rounded-[18px] border border-slate-200/90 bg-[#f8fbff] p-[18px] text-[13px] leading-[1.75] text-slate-500";
const BUTTON = "rounded-full px-[18px] py-3 text-xs font-extrabold transition hover:-translate-y-px disabled:translate-y-0";
const PRIMARY_BUTTON = `${BUTTON} btn-brand shadow-[0_14px_28px_rgba(0,120,215,0.22)] disabled:shadow-none`;
const SECONDARY_BUTTON = `${BUTTON} border border-blue-200 bg-blue-50 text-blue-700`;

function StatusChip({ status }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border px-2.5 py-[7px] text-[10px] font-extrabold ${getStatusBadgeClass(status)}`}
    >
      <span aria-hidden="true" className="size-[7px] rounded-full bg-current opacity-80" />
      {getStatusLabel(status)}
    </span>
  );
}

function Topbar({ status }) {
  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b border-slate-300/70 bg-[#f7faff]/75 px-[18px] py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur-[18px] backdrop-saturate-150 min-[820px]:px-7 min-[820px]:py-[18px]">
      <div className="flex items-center gap-3.5">
        <div className="size-[46px] shrink-0 rounded-2xl bg-linear-145 from-slate-900 via-blue-700 via-62% to-teal-500 shadow-[0_14px_28px_rgba(29,78,216,0.22)]" />
        <div>
          <strong className="block font-space-grotesk text-[19px] tracking-[-0.4px] text-slate-900">KPI Training Center</strong>
          <span className="mt-[3px] block text-xs font-semibold text-slate-500">
            Training delivery, content review, and QCM completion
          </span>
        </div>
      </div>
      <div
        role="status"
        className="inline-flex items-center gap-2 rounded-full border border-slate-400/15 bg-white/80 px-3.5 py-2.5 text-xs font-bold text-slate-500 shadow-[0_14px_28px_rgba(15,23,42,0.06)]"
      >
        <span aria-hidden="true" className="size-2 rounded-full bg-emerald-600 shadow-[0_0_0_5px_rgba(5,150,105,0.12)]" />
        {status}
      </div>
    </header>
  );
}

function MessagePanel({ title, code, children }) {
  return (
    <div className={`${PANEL} p-[30px] text-center`}>
      <h2 className="font-space-grotesk text-[28px] font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-3 max-w-[620px] text-sm leading-[1.75] text-slate-500">{children}</p>
      {code && (
        <div className="mt-[18px] inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-extrabold text-blue-700">
          {code}
        </div>
      )}
    </div>
  );
}

function Sidebar({ assignments, person, activeResultId, onSelect }) {
  const completedCount = assignments.filter((assignment) => assignment.progress.test_completed).length;
  const metrics = [
    ["Assigned", assignments.length],
    ["Completed", completedCount],
    ["Active", assignments.length - completedCount],
    ["Tests", assignments.filter((assignment) => assignment.test.available).length],
  ];

  return (
    // Beside the workspace (wide screens) it stays in view and scrolls on its own, so every
    // assignment card can be reached without scrolling the whole page down. Its scrollbar sits in
    // the gap next to the workspace, so the panels keep their full width.
    <aside className="grid items-start gap-[18px] min-[820px]:grid-cols-3 min-[1300px]:sticky min-[1300px]:top-[92px] min-[1300px]:-ml-3 min-[1300px]:-mr-4 min-[1300px]:max-h-[calc(100vh-108px)] min-[1300px]:grid-cols-1 min-[1300px]:overflow-y-auto min-[1300px]:overscroll-contain min-[1300px]:pb-4 min-[1300px]:pl-3 min-[1300px]:pr-1.5 min-[1300px]:[scrollbar-color:rgb(148_163_184/0.6)_transparent] min-[1300px]:[scrollbar-gutter:stable] min-[1300px]:[scrollbar-width:thin]">
      <div
        className={`${PANEL_FRAME} relative overflow-hidden bg-linear-160 from-[#081427] via-[#153f9a] via-55% to-[#0d9488] p-6 text-white shadow-[0_28px_68px_rgba(8,20,39,0.22)] min-[820px]:col-span-full`}
      >
        <div aria-hidden="true" className="absolute inset-0 bg-radial-[circle_at_top_right] from-white/15 to-transparent to-32%" />
        <div aria-hidden="true" className="absolute -right-[68px] -top-[76px] size-[220px] rounded-full bg-radial from-white/20 to-transparent to-64%" />
        <div className="relative">
          <span className={`${EYEBROW} mr-2`}>Responsible Workspace</span>
          <div className="mt-3.5 inline-flex items-center rounded-[14px] border border-white/15 bg-white/10 px-3 py-[9px] text-[11px] font-bold text-white/90">
            Interactive training cockpit
          </div>
          <h2 className="mt-4 max-w-[280px] font-space-grotesk text-[30px] font-bold leading-[1.08] tracking-[-0.8px]">
            Learn the content, answer independently, and submit with confidence.
          </h2>
          <p className="mt-3 max-w-[260px] text-[13px] leading-[1.7] text-white/80">
            The responsible view keeps the workflow polished and focused, while answer keys stay hidden so each QCM is
            completed without hints from the source material.
          </p>
        </div>
      </div>

      <div className={`${PANEL} px-[22px] py-5`}>
        <div className={SECTION_TITLE}>Responsible</div>
        <div className="mt-3 text-[22px] font-extrabold tracking-[-0.4px] text-slate-900">{person.name || "Responsible"}</div>
        <div className="mt-1.5 text-[13px] text-slate-500">{person.role_name || "Active assignment owner"}</div>
        {person.email && (
          <div className="mt-3 inline-flex max-w-full items-center break-all rounded-full border border-slate-200/90 bg-slate-50 px-3 py-[9px] text-xs font-bold text-slate-500">
            {person.email}
          </div>
        )}
        <div className="mt-[18px] grid gap-3 min-[820px]:grid-cols-2">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-[18px] border border-slate-200/90 bg-linear-to-b from-white to-[#f8fbff] p-3.5">
              <span className={`${METRIC_LABEL} text-slate-500`}>{label}</span>
              <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.9px] text-slate-900">{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className={`${PANEL} px-[18px] pb-[18px] pt-5`}>
        <div className={SECTION_TITLE}>Assignments</div>
        <div className="mt-3.5 flex flex-col gap-3">
          {assignments.map((assignment) => {
            const active = String(assignment.result_id) === String(activeResultId);
            return (
              <button
                key={assignment.result_id}
                type="button"
                aria-current={active || undefined}
                onClick={() => onSelect(assignment.result_id)}
                className={`group relative w-full overflow-hidden rounded-[18px] border bg-linear-to-b from-white to-slate-50/95 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-blue-700/25 hover:shadow-[0_18px_34px_rgba(29,78,216,0.10)] ${
                  active ? "-translate-y-0.5 border-blue-700/25 shadow-[0_18px_34px_rgba(29,78,216,0.10)]" : "border-slate-200/90"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 bg-linear-135 from-blue-600/5 to-teal-500/5 transition-opacity group-hover:opacity-100 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <span className="relative flex items-start justify-between gap-2.5">
                  <span>
                    <span className="block text-sm font-extrabold leading-[1.4] text-slate-900">{assignment.kpi.name}</span>
                    <span className="mt-[5px] block text-xs leading-[1.55] text-slate-500">{assignment.training.name}</span>
                  </span>
                  <StatusChip status={assignment.status} />
                </span>
                <span className="relative mt-3.5 flex items-center justify-between gap-2.5 text-[11px] text-slate-500">
                  <span>Due {formatDate(assignment.due_date)}</span>
                  <span>{assignment.test.question_count} QCM</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHero({ eyebrow, title, description, pills = [], metrics }) {
  return (
    <section
      className={`${PANEL_FRAME} relative overflow-hidden bg-linear-138 from-[#07182f] via-[#14397f] via-56% to-[#0d9488] p-6 shadow-[0_34px_80px_rgba(8,20,39,0.18)] min-[820px]:p-8`}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-radial-[circle_at_top_right] from-white/20 to-transparent to-32%" />
      <div aria-hidden="true" className="absolute inset-0 bg-radial-[circle_at_bottom_left] from-teal-400/25 to-transparent to-28%" />
      <div aria-hidden="true" className="absolute -bottom-[120px] -left-[90px] size-[260px] rounded-full bg-radial from-white/10 to-transparent to-64%" />
      <div aria-hidden="true" className="absolute -right-[84px] -top-[94px] size-[280px] rounded-full bg-radial from-white/20 to-transparent to-68%" />
      <div className="relative grid items-end gap-[18px] min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div>
          <span className={EYEBROW}>{eyebrow}</span>
          <h1 className="mt-3.5 font-space-grotesk text-[length:clamp(30px,4vw,46px)] font-bold leading-[1.04] tracking-[-1.4px] text-white">
            {title}
          </h1>
          <p className="mt-3 max-w-[760px] text-[15px] leading-[1.7] text-white/80">{description}</p>
          {pills.length > 0 && (
            <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
              {pills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-[13px] py-[9px] text-[11px] font-extrabold tracking-[0.2px] text-white/90"
                >
                  {pill}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-3 min-[820px]:grid-cols-2">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-[18px] border border-white/15 bg-white/10 p-4">
              <span className={`${METRIC_LABEL} text-white/70`}>{label}</span>
              <strong className="mt-2 block text-lg font-extrabold tracking-[-0.4px] text-white">{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepStrip({ assignment }) {
  return (
    <div className="grid gap-3 min-[1100px]:grid-cols-4">
      {buildTrainingSteps(assignment).map((step) => (
        <div
          key={step.title}
          className={`rounded-[18px] border px-[18px] py-4 shadow-[0_22px_54px_rgba(15,23,42,0.07)] ${
            step.done
              ? "border-emerald-200 bg-linear-to-b from-emerald-50 to-white"
              : step.current
                ? "border-blue-200 bg-linear-to-b from-blue-50 to-white"
                : "border-slate-200/90 bg-linear-to-b from-white/90 to-slate-50/90"
          }`}
        >
          <strong className="block text-[13px] font-extrabold text-slate-900">{step.title}</strong>
          <span className="mt-1.5 block text-xs leading-normal text-slate-500">{step.copy}</span>
        </div>
      ))}
    </div>
  );
}

function PanelHead({ section, title, status, children }) {
  return (
    <div className="mb-[18px] flex items-start justify-between gap-4">
      <div>
        <div className={SECTION_TITLE}>{section}</div>
        <h2 className="font-space-grotesk text-2xl font-bold tracking-[-0.6px] text-slate-900">{title}</h2>
        <p className="mt-2 max-w-[540px] text-[13px] leading-[1.65] text-slate-500">{children}</p>
      </div>
      {status && <StatusChip status={status} />}
    </div>
  );
}

function Callout({ title, children }) {
  return (
    <div className="mb-[18px] rounded-[20px] border border-blue-200 bg-linear-135 from-blue-50 to-cyan-50 px-[18px] py-4">
      <strong className="block text-[13px] font-extrabold text-slate-900">{title}</strong>
      <span className="mt-2 block text-[13px] leading-[1.72] text-slate-500">{children}</span>
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
  // The "Questions" section of the training HTML is cut out so the reading material never shows the quiz.
  const html = useMemo(
    () => (assignment.training.html_available ? removeQuestionsSection(assignment.training.html || "") : ""),
    [assignment]
  );
  const note = stripAnswerRevealLines(assignment.training.comments || "");

  return (
    <section className={`${PANEL} p-5 min-[820px]:p-6`}>
      <PanelHead section="Documentation" title={assignment.training.name} status={assignment.status}>
        Read the full documentation first. When you reach the end, click <strong>Move to quizzes for all KPI</strong> to
        unlock and display the QCM in this same training center endpoint.
      </PanelHead>

      <Callout title="Documentation first">
        The quiz stays hidden until the responsible confirms that the documentation has been reviewed. Correct answers are
        still removed from the training material before rendering.
      </Callout>

      {note && (
        <div className="mb-[18px] rounded-[18px] border border-emerald-200/90 bg-linear-135 from-teal-700/10 to-blue-700/10 px-4 py-[15px] text-[13px] leading-[1.7] text-slate-800">
          {note}
        </div>
      )}

      {html.trim() ? (
        <div className="overflow-hidden rounded-[22px] border border-slate-200/90 bg-white">
          <iframe
            title={`Training documentation: ${assignment.training.name}`}
            srcDoc={html}
            className="block min-h-[520px] w-full border-0 bg-white"
          />
        </div>
      ) : blocks.length ? (
        <div className="grid gap-3.5">
          {blocks.map((block) => (
            <article
              key={block.id}
              className="relative rounded-[20px] border border-slate-200/90 bg-linear-to-b from-white to-[#f8fbff] py-5 pl-[22px] pr-5 shadow-[0_18px_32px_rgba(15,23,42,0.04)]"
            >
              <span aria-hidden="true" className="absolute bottom-[18px] left-0 top-[18px] w-1 rounded-full bg-linear-to-b from-blue-600 to-teal-500" />
              <h3 className="text-base font-extrabold text-slate-900">{block.title}</h3>
              {block.body && <p className="mt-2.5 whitespace-pre-wrap text-sm leading-[1.75] text-slate-800">{block.body}</p>}
              {block.bullets.length > 0 && (
                <ul className="mt-3 list-disc pl-[18px] text-slate-800">
                  {block.bullets.map((bullet, index) => (
                    <li key={index} className="mb-2 text-[13px] leading-[1.7]">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className={STATE_BOX}>
          {note
            ? "No structured documentation blocks were found for this assignment."
            : "No documentation content is available for this assignment yet."}
        </div>
      )}
    </section>
  );
}

function QuestionCard({ question, index, resultId, values, onChange }) {
  const prompt = stripAnswerRevealLines(question.prompt) || `Question ${index + 1}`;
  const helpText = stripAnswerRevealLines(question.help_text || "");

  return (
    <article
      id={`question-${resultId}-${question.id}`}
      className="scroll-mt-28 rounded-[20px] border border-slate-200/90 bg-linear-to-b from-white to-slate-50/95 p-5 shadow-[0_18px_36px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[14px] border border-blue-200 bg-linear-135 from-blue-50 to-cyan-50 text-xs font-extrabold text-blue-700">
          {index + 1}
        </span>
        <div>
          <strong className="block text-[15px] leading-[1.6] text-slate-900">{prompt}</strong>
          {helpText && <p className="mt-1.5 text-xs leading-[1.6] text-slate-500">{helpText}</p>}
        </div>
      </div>
      <div className="mt-3.5 rounded-2xl border border-slate-200/90 bg-slate-50 px-3.5 py-3 text-xs leading-[1.65] text-slate-500">
        {getQuestionGuidance(question)}
      </div>

      {question.type === "text" ? (
        <input
          type="text"
          value={values[0] || ""}
          placeholder="Type the best answer here"
          onChange={(event) => onChange(question, event.target.value, true)}
          className="mt-3.5 min-h-[50px] w-full rounded-2xl border border-slate-200/90 bg-white px-3.5 py-[13px] text-[13px] text-slate-800 outline-none transition focus:border-blue-700/45 focus:shadow-[0_0_0_4px_rgba(29,78,216,0.10)]"
        />
      ) : (
        <div className="mt-3.5 grid gap-2.5">
          {(question.options || []).map((option, optionIndex) => {
            const checked = values.includes(option.key);
            return (
              <label key={option.key} className="group block cursor-pointer">
                <input
                  type={question.type === "multi" ? "checkbox" : "radio"}
                  name={`question-${resultId}-${question.id}`}
                  value={option.key}
                  checked={checked}
                  onChange={(event) => onChange(question, option.key, event.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className={`flex items-start gap-3.5 rounded-[18px] border p-[15px] transition duration-200 group-hover:-translate-y-px peer-focus-visible:ring-4 peer-focus-visible:ring-blue-700/15 ${
                    checked
                      ? "border-blue-600/40 bg-linear-to-b from-blue-50 to-white shadow-[0_18px_34px_rgba(29,78,216,0.12)]"
                      : "border-slate-200/90 bg-linear-to-b from-white to-[#f8fbff] group-hover:border-blue-600/30 group-hover:shadow-[0_18px_32px_rgba(29,78,216,0.08)]"
                  }`}
                >
                  <span
                    className={`inline-flex size-[38px] shrink-0 items-center justify-center rounded-[14px] border text-xs font-extrabold transition ${
                      checked
                        ? "border-transparent bg-linear-135 from-blue-700 to-sky-500 text-white shadow-[0_14px_26px_rgba(29,78,216,0.18)]"
                        : "border-blue-200 bg-linear-135 from-blue-50 to-cyan-50 text-blue-700"
                    }`}
                  >
                    {getChoiceBadge(optionIndex)}
                  </span>
                  <span className="self-center text-[13px] leading-[1.72] text-slate-800">
                    {stripAnswerRevealLines(option.label) || `Option ${getChoiceBadge(optionIndex)}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </article>
  );
}

function ReviewBox({ label, children }) {
  return (
    <div className="rounded-[14px] border border-slate-200/90 bg-slate-50 px-[13px] py-3">
      <span className="block text-[10px] font-extrabold uppercase tracking-[0.64px] text-slate-500">{label}</span>
      <p className="mt-[7px] text-xs leading-[1.65] text-slate-800">{children}</p>
    </div>
  );
}

function ReviewSection({ assignment }) {
  return (
    <>
      <div
        className={`relative mb-4 overflow-hidden rounded-[20px] border p-[18px] ${
          assignment.passed ? "border-emerald-200 bg-linear-135 from-emerald-50 to-white" : "border-orange-200 bg-linear-135 from-orange-50 to-white"
        }`}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 rounded-full bg-linear-to-b from-blue-600/80 to-teal-500/80" />
        <strong className="block text-2xl font-extrabold text-slate-900">Assessment Completed</strong>
        <span className="mt-2 block text-[13px] leading-[1.7] text-slate-500">
          Final score: {assignment.score === null ? "-" : `${assignment.score}%`} / Pass threshold: {assignment.test.pass_score}%.
        </span>
      </div>

      <div className="grid gap-3">
        {(assignment.review || []).map((entry, index) => {
          const isCorrect = entry.is_correct === true;
          const outcome = isCorrect ? "Accepted" : "To be improved";
          return (
            <div
              key={entry.question_id || index}
              className={`rounded-[18px] border p-4 ${
                isCorrect ? "border-emerald-200 bg-linear-to-b from-emerald-50 to-white" : "border-orange-300 bg-linear-to-b from-orange-50 to-white"
              }`}
            >
              <strong className="block text-sm leading-[1.55] text-slate-900">{entry.prompt || `Question ${index + 1}`}</strong>
              <div className="mt-3 grid gap-2.5 min-[820px]:grid-cols-2">
                <ReviewBox label="Submitted answer">{(entry.selected_labels || []).join(", ") || "No answer recorded"}</ReviewBox>
                <ReviewBox label="Result">{outcome}</ReviewBox>
              </div>
              <span
                className={`mt-3 inline-flex items-center rounded-full border px-3 py-2 text-[11px] font-extrabold ${
                  isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-300 bg-orange-50 text-orange-700"
                }`}
              >
                {outcome}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AssessmentPanel({ assignment, answers, onAnswerChange }) {
  if (!assignment.test.available) {
    return (
      <section className={`${PANEL} p-5 min-[820px]:p-6`}>
        <PanelHead section="Assessment" title="No linked QCM">
          This training assignment does not currently reference a row in <code>kpi_test</code>.
        </PanelHead>
        <div className={STATE_BOX}>
          If you want to send a questionnaire to the responsible, connect this training assignment to{" "}
          <code>kpi_test.test_id</code> and populate <code>questionnaire_json</code>.
        </div>
      </section>
    );
  }

  const { progress } = assignment;
  const locked = !progress.training_completed && !progress.test_completed;
  const questions = assignment.test.questions || [];
  const draft = answers[assignment.result_id] || {};
  const questionSet = `${questions.length} question${questions.length === 1 ? "" : "s"}${
    questions.some((question) => question.type === "multi") ? " with mixed response types" : " ready to answer"
  }`;

  return (
    <section className={`${PANEL} p-5 min-[820px]:p-6`}>
      <PanelHead section="Assessment" title={assignment.test.name} status={assignment.status}>
        The QCM is generated from <code>kpi_test.questionnaire_json</code>. Answers are written back into{" "}
        <code>kpi_training_result.answers_json</code> and scored on submission, while correct answers stay hidden in the
        responsible view.
      </PanelHead>

      <div className="mb-[18px] grid gap-3 min-[1100px]:grid-cols-3">
        {[
          ["Assessment Mode", "Blind answer selection"],
          ["Question Set", questionSet],
          ["Visibility Rule", "Correct answers hidden"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[18px] border border-slate-200/90 bg-linear-to-b from-white to-slate-50/95 p-4">
            <span className={`${METRIC_LABEL} text-slate-500`}>{label}</span>
            <strong className="mt-2 block text-[15px] font-extrabold leading-[1.45] text-slate-900">{value}</strong>
          </div>
        ))}
      </div>

      <Callout title="Answer without hints">
        This responsible-facing view never shows the correct answer before submission. Read the training content, then
        choose the option you believe is right for each question.
      </Callout>

      {locked && (
        <div className={STATE_BOX}>
          Finish the training step first. Once the training is marked complete, the questionnaire becomes available and the
          test due date is activated.
        </div>
      )}

      {!locked && !progress.test_completed && !questions.length && (
        <div className={STATE_BOX}>
          This assignment references a test, but no renderable QCM questions were found in <code>questionnaire_json</code>.
        </div>
      )}

      {!locked && !progress.test_completed && questions.length > 0 && (
        <div className="grid gap-3.5">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              resultId={assignment.result_id}
              values={draft[question.id] || []}
              onChange={(...change) => onAnswerChange(assignment.result_id, ...change)}
            />
          ))}
        </div>
      )}

      {progress.test_completed && <ReviewSection assignment={assignment} />}
    </section>
  );
}

function ActionRow({ hint, error, children }) {
  return (
    <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3">
      <small className={`text-xs ${error ? "font-bold text-red-700" : "text-slate-500"}`}>{error || hint}</small>
      {children}
    </div>
  );
}

function QuizConfirmModal({ onCancel, onConfirm }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 p-5 backdrop-blur-sm animate-kpi-fade">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-confirm-title"
        className="w-[480px] max-w-full rounded-[28px] bg-white p-8 text-center shadow-[0_40px_80px_rgba(15,23,42,0.20)] animate-kpi-dialog"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-[18px] flex size-[72px] items-center justify-center rounded-[20px] bg-linear-135 from-blue-600/10 to-teal-500/10 text-[32px]"
        >
          📝
        </div>
        <h3 id="quiz-confirm-title" className="mb-3 text-[26px] font-extrabold text-slate-900">
          Move to Quiz
        </h3>
        <p className="text-sm leading-[1.8] text-slate-500">
          Are you sure you want to move to the quiz? The documentation will be hidden and the questionnaire will be displayed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
            Continue Reading
          </button>
          <button type="button" className={PRIMARY_BUTTON} onClick={onConfirm} autoFocus>
            Move to Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingCenterPage() {
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
  preinit(FONTS_URL, { as: "style", precedence: "default" });

  const [searchParams, setSearchParams] = useSearchParams();
  const peopleId = searchParams.get("people_id");
  // The assignment of the e-mail link (?result_id=), read once: the URL then follows the selected card.
  const [preferredResultId] = useState(() => searchParams.get("result_id"));

  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(Boolean(peopleId));
  const [error, setError] = useState("");
  const [status, setStatus] = useState(
    peopleId ? "Loading training assignments..." : "Waiting for a people_id query parameter"
  );
  const [activeResultId, setActiveResultId] = useState(null);
  // "docs": every KPI's documentation; "quiz": every questionnaire, once confirmed; "review": the
  // results, once all the questionnaires were submitted.
  const [view, setView] = useState("docs");
  const [answers, setAnswers] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [flash, setFlash] = useState(null);

  const fetchPortal = async () => {
    const res = await apiClient.get("/api/kpi-training/portal", { params: { people_id: peopleId } });
    return res.data;
  };

  const focusAssignment = (resultId) => {
    if (!resultId) return;
    setActiveResultId(String(resultId));
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.set("result_id", String(resultId));
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (!peopleId) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setStatus("Loading assigned trainings...");
      try {
        const data = await fetchPortal();
        if (cancelled) return;
        setPortal(data);
        focusAssignment(pickActiveResultId(data, preferredResultId));
        setStatus(data.assignments?.length ? "Training center ready" : "No active assignments found");
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "Could not load the training portal."));
        setStatus("Training portal unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleId]);

  const assignments = portal?.assignments || [];
  const person = portal?.people || assignments[0]?.responsible || {};
  const completedCount = assignments.filter((assignment) => assignment.progress.test_completed).length;
  const totalQuestions = assignments.reduce((sum, assignment) => sum + Number(assignment.test.question_count || 0), 0);
  const flashError = flash?.type === "error" ? flash.message : "";

  const selectAssignment = (resultId) => {
    focusAssignment(resultId);
    const section = view === "quiz" ? "quiz" : view === "review" ? "review" : "doc";
    document.getElementById(`${section}-${resultId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAnswerChange = (resultId, question, value, checked) => {
    setAnswers((prev) => {
      const forResult = prev[resultId] || {};
      const current = forResult[question.id] || [];
      let next;
      if (question.type === "text") next = value ? [value] : [];
      else if (question.type === "multi") next = checked ? [...new Set([...current, value])] : current.filter((v) => v !== value);
      else next = [value];
      return { ...prev, [resultId]: { ...forResult, [question.id]: next } };
    });
  };

  const unlockQuizzes = async () => {
    setConfirmOpen(false);
    setWorking(true);
    setFlash(null);
    setStatus("Unlocking all questionnaires...");
    try {
      for (const assignment of assignments) {
        if (!assignment.progress.training_completed && !assignment.progress.test_completed) {
          await apiClient.post(`/api/kpi-training/results/${assignment.result_id}/training-complete`, {});
        }
      }
      setView("quiz");
      setFlash({ type: "success", message: "All documentation completed. All quizzes are now unlocked." });
      setStatus("Questionnaires ready");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFlash({ type: "error", message: getApiErrorMessage(err, "Could not unlock all quizzes.") });
      setStatus("Training center ready");
    } finally {
      setWorking(false);
    }
  };

  const submitAllQuizzes = async () => {
    const submissions = [];
    for (const assignment of assignments) {
      if (!assignment.test.available || assignment.progress.test_completed) continue;
      const questions = assignment.test.questions || [];
      const submitted = collectQuizAnswers(questions, answers[assignment.result_id]);
      const unanswered = findUnansweredQuestions(questions, submitted);
      if (unanswered.length) {
        setFlash({
          type: "error",
          message: `Please complete all questions for ${assignment.kpi.name}. Missing: ${unanswered.length}.`,
        });
        document
          .getElementById(`question-${assignment.result_id}-${unanswered[0].id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      submissions.push({ assignment, submitted });
    }

    if (!submissions.length) {
      setFlash({ type: "error", message: "No quiz is ready to submit." });
      return;
    }

    setWorking(true);
    setFlash(null);
    setStatus("Submitting all questionnaires...");
    try {
      for (const { assignment, submitted } of submissions) {
        await apiClient.post(`/api/kpi-training/results/${assignment.result_id}/test-submit`, { answers: submitted });
      }
      setPortal(await fetchPortal());
      setView("review");
      setFlash({ type: "success", message: "Assessment completed. Review is now displayed." });
      setStatus("Assessment completed");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFlash({ type: "error", message: getApiErrorMessage(err, "Could not submit all questionnaires.") });
      setStatus("Questionnaires ready");
      // The quizzes sent before the failure are recorded: reload so they show as submitted and are
      // not sent a second time.
      fetchPortal().then(setPortal, () => {});
    } finally {
      setWorking(false);
    }
  };

  let content;
  if (!peopleId) {
    content = (
      <MessagePanel title="Open the training center with a responsible id" code="/kpi-training-center?people_id=123">
        This page reads assigned training rows from <code>kpi_training_result</code>, then loads the learning content from{" "}
        <code>kpi_training</code> and the QCM from <code>kpi_test</code>.
      </MessagePanel>
    );
  } else if (loading) {
    content = <div className="p-10 text-center text-sm font-bold text-slate-500">Preparing the training workspace...</div>;
  } else if (error) {
    content = <MessagePanel title="We could not open the training workspace">{error}</MessagePanel>;
  } else if (!assignments.length) {
    content = (
      <MessagePanel title="No active training assignments">
        {person.name || "This responsible"} does not currently have rows in <code>kpi_training_result</code> that can be
        displayed in the training center.
      </MessagePanel>
    );
  } else {
    content = (
      <div className="grid items-start gap-5 min-[1300px]:grid-cols-[272px_minmax(0,1fr)]">
        <Sidebar assignments={assignments} person={person} activeResultId={activeResultId} onSelect={selectAssignment} />

        <main className="min-w-0">
          {view === "review" ? (
            <>
              <WorkspaceHero
                eyebrow="Assessment Completed"
                title="Quiz review"
                description="All submitted answers are now locked. Correct answers show as Accepted. Wrong answers show as To be improved."
                metrics={[
                  ["Assigned", assignments.length],
                  ["Completed", completedCount],
                  ["Status", "Completed"],
                  ["Review", "Visible"],
                ]}
              />
              <div className="mt-[18px] grid gap-5">
                {assignments.map((assignment) => (
                  <div key={assignment.result_id} id={`review-${assignment.result_id}`} className="grid scroll-mt-24 gap-3">
                    <StepStrip assignment={assignment} />
                    <AssessmentPanel assignment={assignment} answers={answers} onAnswerChange={handleAnswerChange} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <WorkspaceHero
                eyebrow="Training Journey"
                title="All assigned KPI trainings"
                description="Review the documentation for every assigned KPI first. After that, move to the quiz section for all assigned KPI tests."
                pills={[`${assignments.length} KPI assigned`, "Documentation first", "Quiz after review"]}
                metrics={[
                  ["Assigned", assignments.length],
                  ["Completed", completedCount],
                  ["QCM", totalQuestions],
                  ["Status", "Grouped view"],
                ]}
              />

              {view === "docs" ? (
                <>
                  <div className="mt-[18px] grid gap-5">
                    {assignments.map((assignment) => (
                      <div key={assignment.result_id} id={`doc-${assignment.result_id}`} className="grid scroll-mt-24 gap-3">
                        <StepStrip assignment={assignment} />
                        <DocumentationPanel assignment={assignment} />
                      </div>
                    ))}
                  </div>
                  <ActionRow hint="After reading all KPI documentation, unlock the quizzes." error={flashError}>
                    <button type="button" className={PRIMARY_BUTTON} disabled={working} onClick={() => setConfirmOpen(true)}>
                      Move to quizzes for all KPI
                    </button>
                  </ActionRow>
                </>
              ) : (
                <div className="mt-[18px] grid gap-5">
                  {/* Confirming the move to the quiz completes every training step, so each QCM is open here. */}
                  {assignments.map((assignment) => (
                    <div key={assignment.result_id} id={`quiz-${assignment.result_id}`} className="scroll-mt-24">
                      <AssessmentPanel
                        assignment={{ ...assignment, progress: { ...assignment.progress, training_completed: true, test_sent: true } }}
                        answers={answers}
                        onAnswerChange={handleAnswerChange}
                      />
                    </div>
                  ))}
                  <ActionRow hint="Submit all completed KPI quizzes together." error={flashError}>
                    <button type="button" className={PRIMARY_BUTTON} disabled={working} onClick={submitAllQuizzes}>
                      {working ? "Submitting..." : "Submit all QCM"}
                    </button>
                  </ActionRow>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-linear-to-b from-[#f8fbff] via-[#f3f7fb] to-[#eef4f8] font-manrope text-slate-800">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(15,118,110,0.12),transparent_26%)]"
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute right-[6%] top-[120px] size-[280px] rounded-full bg-blue-600/20 opacity-45 blur-[70px]" />
        <div className="absolute bottom-[12%] left-[4%] size-[260px] rounded-full bg-teal-500/15 opacity-45 blur-[70px]" />
      </div>

      <Topbar status={status} />

      <div className="px-3 pb-3 pt-3 min-[820px]:px-5 min-[820px]:pb-[26px] min-[820px]:pt-[18px]">
        {flash && (
          <div
            role={flash.type === "error" ? "alert" : "status"}
            className={`mb-4 rounded-[18px] border px-[18px] py-3.5 text-[13px] font-bold ${
              flash.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {flash.message}
          </div>
        )}
        {content}
      </div>

      {confirmOpen && <QuizConfirmModal onCancel={() => setConfirmOpen(false)} onConfirm={unlockQuizzes} />}
    </div>
  );
}

// Shared helpers for the KPI Training pages (Center, Documentation, Dashboard).
// Ported from the original kpi-training-center.html / kpi-training-documentation.html
// vanilla-JS implementations so all three React pages stay behaviourally identical.

export const STATUS_LABELS = {
  training_sent: "Training Assigned",
  training_done: "Training Completed",
  test_sent: "Assessment Ready",
  test_overdue: "Assessment Overdue",
  completed_pass: "Passed",
  completed_fail: "Failed",
  escalated: "Escalated",
};

export const STATUS_BADGE_CLASSES = {
  training_sent: "bg-blue-50 text-blue-700",
  training_done: "bg-teal-50 text-teal-700",
  test_sent: "bg-amber-50 text-amber-700",
  test_overdue: "bg-red-50 text-red-700",
  completed_pass: "bg-green-50 text-green-700",
  completed_fail: "bg-red-50 text-red-700",
  escalated: "bg-red-100 text-red-800",
};

export const getStatusLabel = (status) => STATUS_LABELS[status] || status || "Assigned";

export const getStatusBadgeClass = (status) => STATUS_BADGE_CLASSES[status] || "bg-slate-100 text-slate-600";

export const formatDate = (value) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ANSWER_REVEAL_PATTERNS = [
  /^((good|correct|right|best|expected)\s+answer|(correct|best)\s+option|answer\s+key|solution|bonne\s+r[eé]ponse|r[eé]ponse\s+correcte)\s*[:\-]/i,
  /^(the\s+correct\s+answer\s+is|la\s+bonne\s+r[eé]ponse\s+est|la\s+r[eé]ponse\s+correcte\s+est)\b/i,
];

const normalizeRevealCandidate = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

// Detects an inline "correct answer: ..." style hint so it can be hidden from the responsible view.
export const isAnswerRevealText = (value) => {
  const candidate = normalizeRevealCandidate(value);
  return candidate ? ANSWER_REVEAL_PATTERNS.some((pattern) => pattern.test(candidate)) : false;
};

export const stripAnswerRevealLines = (value) => {
  const text = String(value ?? "");
  if (!text) return "";
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !isAnswerRevealText(line))
    .join("\n\n")
    .trim();
};

export const sanitizeTrainingBlock = (block = {}, fallbackTitle = "Learning Block") => {
  const sanitizedTitle = stripAnswerRevealLines(block.title || "");
  const sanitizedBody = stripAnswerRevealLines(block.body || "");
  const sanitizedBullets = Array.isArray(block.bullets)
    ? block.bullets.map((bullet) => stripAnswerRevealLines(bullet)).filter(Boolean)
    : [];

  return {
    ...block,
    title: sanitizedTitle || (isAnswerRevealText(block.title || "") ? fallbackTitle : String(block.title || fallbackTitle)),
    body: sanitizedBody,
    bullets: sanitizedBullets,
  };
};

export const getChoiceBadge = (index) => String.fromCharCode(65 + (index % 26));

export const getQuestionGuidance = (question) =>
  question.type === "multi"
    ? "Select every option you believe is correct."
    : question.type === "text"
      ? "Type the answer in your own words."
      : "Select the one answer you believe is correct.";

// Removes a "Questions" heading section (and everything up to the next heading) from raw training
// HTML, used by the Training Center's inline documentation preview so the quiz answers never leak
// into the reading material.
export const removeQuestionsSection = (html) => {
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") return html || "";
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const headings = Array.from(doc.querySelectorAll("h1,h2,h3,h4,strong,b")).filter(
    (el) => el.textContent.trim().toLowerCase() === "questions"
  );

  headings.forEach((heading) => {
    let node = heading;
    const toRemove = [];
    while (node) {
      toRemove.push(node);
      const next = node.nextElementSibling;
      if (next && /^h[1-4]$/i.test(next.tagName) && next.textContent.trim().toLowerCase() !== "questions") {
        break;
      }
      node = next;
    }
    toRemove.forEach((el) => el.remove());
  });

  return doc.body.innerHTML;
};

// Question-section / answer-key detection used to keep the dedicated Documentation page free of any
// quiz content (title patterns + "A) ..." / "1) ..." style option lines).
const QUESTION_SECTION_PATTERNS = [
  /^questions?$/i,
  /^question\s*\d+[\s:.)-]*/i,
  /^(assessment|quiz|qcm|knowledge\s*check|review\s*questions?)$/i,
  /^assessment\s+questions?$/i,
];
const QUESTION_OPTION_LINE_PATTERN = /(?:^|\n)\s*(?:[A-D]|[1-9]|[IVX]+)[.)]\s+\S/m;

export const isQuestionSectionTitle = (value) => {
  const normalized = normalizeRevealCandidate(value);
  return normalized ? QUESTION_SECTION_PATTERNS.some((pattern) => pattern.test(normalized)) : false;
};

const hasQuestionOptionLines = (value) =>
  QUESTION_OPTION_LINE_PATTERN.test(String(value ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/\r/g, ""));

const isQuestionLikeDocumentationBlock = (block = {}) => {
  const title = normalizeRevealCandidate(block.title || "");
  const body = String(block.body || "");
  const bullets = Array.isArray(block.bullets) ? block.bullets : [];
  const combined = [title, body, ...bullets].join("\n");
  const hasQuestionPrompt =
    isQuestionSectionTitle(title) ||
    /^question\s*\d+[\s:.)-]*/i.test(normalizeRevealCandidate(combined)) ||
    /\b(?:quiz|qcm|knowledge\s*check)\b/i.test(normalizeRevealCandidate(combined));

  return hasQuestionPrompt && hasQuestionOptionLines(combined);
};

// Documentation-only block list: sanitized + strips any block that looks like a quiz question
// (the dedicated Documentation page never shows quiz content, unlike the Training Center panel).
export const getDocumentationBlocks = (assignment) =>
  (assignment?.training?.blocks || [])
    .map((block) => sanitizeTrainingBlock(block, "Documentation Section"))
    .filter((block) => block.title || block.body || block.bullets.length)
    .filter((block) => !isQuestionLikeDocumentationBlock(block));

// Sanitizes raw training HTML for the dedicated Documentation page: strips scripts/forms, question
// headings/sections and any inline "correct answer" reveals, so responsibles can't see quiz answers.
export const sanitizeTrainingHtml = (html) => {
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, "text/html");
  doc.querySelectorAll("script, noscript").forEach((node) => node.remove());
  doc
    .querySelectorAll("[data-answer], [data-correct-answer], [data-solution], [data-is-correct='true'], [data-correct='true']")
    .forEach((node) => node.remove());
  doc.querySelectorAll("form, input, select, textarea, button").forEach((node) => node.remove());
  doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((element) => {
    if (isQuestionSectionTitle(element.textContent || "")) element.remove();
  });

  doc.body.querySelectorAll("p, li, div, blockquote, td, section, article, pre").forEach((element) => {
    const className = String(element.getAttribute("class") || "").toLowerCase();
    const elementId = String(element.getAttribute("id") || "").toLowerCase();
    if (/(correct-answer|answer-key|good-answer|revealed-answer|solution-note|bonne-reponse|reponse-correcte)/.test(className)) {
      element.remove();
      return;
    }

    const identityText = `${className} ${elementId}`.trim();
    if (/(question|quiz|qcm|questionnaire|knowledge-check|assessment-question)/.test(identityText)) {
      element.remove();
      return;
    }

    if (/<br\s*\/?>/i.test(element.innerHTML || "")) {
      const segments = element.innerHTML.split(/<br\s*\/?>/i);
      const cleanedSegments = segments.filter((segment) => !isAnswerRevealText(segment));
      if (cleanedSegments.length !== segments.length) {
        element.innerHTML = cleanedSegments.join("<br>");
      }
    }

    const candidateText = normalizeRevealCandidate(element.textContent || "");
    if (candidateText && hasQuestionOptionLines(element.innerHTML || candidateText)) {
      if (
        isQuestionSectionTitle(candidateText) ||
        /^question\s*\d+[\s:.)-]*/i.test(candidateText) ||
        /\b(?:quiz|qcm|knowledge\s*check)\b/i.test(candidateText)
      ) {
        element.remove();
        return;
      }
    }

    if (
      candidateText &&
      candidateText.length <= 240 &&
      isAnswerRevealText(candidateText) &&
      !element.querySelector("table, ul, ol, article, section")
    ) {
      element.remove();
      return;
    }

    if (!element.children.length) {
      const cleanedText = stripAnswerRevealLines(element.textContent || "");
      if (cleanedText) element.textContent = cleanedText;
    }
  });

  doc.body.querySelectorAll("p, li, div, blockquote, pre").forEach((element) => {
    const hasChildContent = element.querySelector("img, table, ul, ol, video, iframe");
    const textContent = normalizeRevealCandidate(element.textContent || "");
    if (!hasChildContent && !textContent) element.remove();
  });

  return doc.body.innerHTML;
};

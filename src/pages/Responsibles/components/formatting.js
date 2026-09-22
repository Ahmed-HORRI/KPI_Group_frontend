// Shared formatting / normalization helpers ported 1:1 from the client-side
// script of the original GET /responsible/:responsibleId/dashboard page
// (KPI-Group/index.js:8548-24318).

export function getLastPathSegment(pathText) {
  const normalizedText = String(pathText || "").trim();
  if (!normalizedText) return "";
  const parts = normalizedText
    .split("/")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : normalizedText;
}

export function splitParameterPath(pathText) {
  return String(pathText || "")
    .split("/")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

export function formatParameterDisplayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString("en-US", {
      minimumFractionDigits: Math.abs(numeric % 1) > 0.001 ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

export function getLocalDateInputValue(value = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeParameterDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) return getLocalDateInputValue(value);

  const text = String(value).trim();
  if (!text) return "";

  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : getLocalDateInputValue(parsed);
}

export function formatParameterDisplayDate(value) {
  if (!value) return "-";
  const normalizedValue = normalizeParameterDateValue(value);
  const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatKpiDetailTimestamp(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatKpiDetailNumber(value, unit = "") {
  const formatted = formatParameterDisplayValue(value);
  if (formatted === "-") return "-";
  return unit ? `${formatted} ${unit}` : formatted;
}

export function normalizeNullableFieldValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (lowered === "none" || lowered === "null" || lowered === "undefined" || lowered === "nan") {
    return "";
  }
  return text;
}

export function inferValueType(value) {
  const text = normalizeNullableFieldValue(value);
  if (!text) return "Null";
  if (!Number.isNaN(Number(text)) && Number(text) === 0) return "0";
  return "Valeur a entrer";
}

// ---------------------------------------------------------------------------
// Tolerance / limit arithmetic (original script lines 6497-6700)
// ---------------------------------------------------------------------------

export function normalizeLimitInput(value, allowPercent = false) {
  if (value === null || value === undefined) return null;
  let normalized = String(value).trim();
  if (!normalized) return null;

  normalized = normalized.replace(/\s+/g, "").replace(/,/g, ".");
  if (allowPercent && normalized.endsWith("%")) {
    normalized = normalized.slice(0, -1);
  }

  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized) ? normalized : null;
}

export function parseLimitNumber(value, allowPercent = false) {
  const normalized = normalizeLimitInput(value, allowPercent);
  return normalized === null ? null : Number(normalized);
}

export function formatCalculatedLimit(value) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(10).replace(/\.?0+$/, "");
}

export function isRelativeToleranceType(toleranceType) {
  return String(toleranceType || "").trim().toLowerCase() === "relative";
}

export function parseToleranceInputValue(value) {
  if (value === null || value === undefined) {
    return { text: "", numeric: null, hasPercent: false };
  }
  const text = String(value).trim();
  if (!text) return { text: "", numeric: null, hasPercent: false };

  const normalized = normalizeLimitInput(text, true);
  return {
    text,
    numeric: normalized === null ? null : Number(normalized),
    hasPercent: text.includes("%"),
  };
}

export function parseToleranceDelta(value, toleranceType, direction = "up") {
  const { numeric, hasPercent } = parseToleranceInputValue(value);
  if (!Number.isFinite(numeric)) return null;

  let delta = numeric;
  if (isRelativeToleranceType(toleranceType)) {
    delta = hasPercent || Math.abs(delta) > 1 ? delta / 100 : delta;
  }
  if (direction === "up") return Math.abs(delta);
  return delta > 0 ? -delta : delta;
}

export function formatToleranceForInput(value, toleranceType, direction = "up") {
  const parsed = parseToleranceInputValue(value);
  if (!parsed.text) return "";
  if (!Number.isFinite(parsed.numeric)) return parsed.text;

  let displayValue = parsed.numeric;
  if (isRelativeToleranceType(toleranceType)) {
    displayValue =
      parsed.hasPercent || Math.abs(displayValue) > 1 ? displayValue : displayValue * 100;
  }
  if (direction === "up") {
    displayValue = Math.abs(displayValue);
  } else if (displayValue > 0) {
    displayValue = -displayValue;
  }

  const suffix = isRelativeToleranceType(toleranceType) ? "%" : "";
  return formatCalculatedLimit(displayValue) + suffix;
}

export function serializeToleranceForPayload(value, toleranceType, direction = "up") {
  const parsed = parseToleranceInputValue(value);
  if (!parsed.text) return "";
  const delta = parseToleranceDelta(value, toleranceType, direction);
  return Number.isFinite(delta) ? formatCalculatedLimit(delta) : parsed.text;
}

// Relative tolerance recomputes high/low limits from the target. Absolute
// tolerance deliberately does nothing (original: `if (absolute) return;`).
export function recalculateLimits({ target, toleranceType, upTolerance, lowTolerance }) {
  const normalizedType = String(toleranceType || "").trim().toLowerCase();
  if (normalizedType !== "relative") return null;

  const targetValue = parseLimitNumber(target);
  const upToleranceValue = parseToleranceDelta(upTolerance, normalizedType, "up");
  const lowToleranceValue = parseToleranceDelta(lowTolerance, normalizedType, "low");

  if (
    !Number.isFinite(targetValue) ||
    !Number.isFinite(upToleranceValue) ||
    !Number.isFinite(lowToleranceValue)
  ) {
    return null;
  }

  return {
    high_limit: formatCalculatedLimit(targetValue * (1 + upToleranceValue)),
    low_limit: formatCalculatedLimit(targetValue * (1 + lowToleranceValue)),
  };
}

// Shared helpers for the KPI entry form (/form).
//
// The out-of-target rule mirrors the backend's getKpiStatus/getKpiBounds
// (kpiShared.service.js) exactly: the two limits are sorted into
// lower/upper bounds first, then a "down" KPI is bad above the upper bound
// and any other KPI is bad below the lower bound. The original page shipped
// the same rule twice (server-side and as a client mirror); keeping one
// implementation here avoids the two drifting apart.

export const CA_STATUS_OPTIONS = ["Open", "Waiting for validation", "Completed", "Closed"];
export const CA_IMPORTANCE_OPTIONS = ["High", "Medium", "Low"];
export const CA_URGENCY_OPTIONS = ["Flexible", "Urgent", "Secondary"];

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getKpiBounds(lowLimit, highLimit) {
  const bounds = [toNumber(lowLimit), toNumber(highLimit)].filter((value) => value !== null);
  if (!bounds.length) return { lowerBound: null, upperBound: null };
  return { lowerBound: Math.min(...bounds), upperBound: Math.max(...bounds) };
}

export function isOutOfTarget(value, lowLimit, highLimit, direction = "up") {
  const numericValue = toNumber(value);
  if (numericValue === null) return false;

  const { lowerBound, upperBound } = getKpiBounds(lowLimit, highLimit);
  if (String(direction).toLowerCase() === "down") {
    return upperBound !== null && numericValue > upperBound;
  }
  return lowerBound !== null && numericValue < lowerBound;
}

// The original required all four of these fields before it accepted a
// corrective action as valid (hasValidCorrectiveAction, index.js).
export function isCompleteCorrectiveAction(action) {
  return Boolean(
    String(action?.root_cause || "").trim() &&
    String(action?.implemented_solution || "").trim() &&
    String(action?.due_date || "").trim() &&
    String(action?.responsible || "").trim()
  );
}

export function createEmptyCorrectiveAction(defaultResponsible = "") {
  return {
    corrective_action_id: null,
    root_cause: "",
    implemented_solution: "",
    due_date: "",
    estimated_duration_days: "",
    responsible: defaultResponsible || "",
    importance: "",
    urgency: "",
    status: "Open",
  };
}

export function formatNumber(value) {
  const numericValue = toNumber(value);
  if (numericValue === null) return "N/A";
  return Number(numericValue.toFixed(2)).toString();
}

export function formatTimestamp(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

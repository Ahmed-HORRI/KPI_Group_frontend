import { useEffect, useMemo, useRef, useState } from "react";
import {
  KFS_OPTIONS,
  UNIT_OPTIONS,
  FREQUENCY_OPTIONS,
  DIRECTION_OPTIONS,
  MIN_MAX_TYPE_OPTIONS,
  REACTIVITY_STATUS_OPTIONS,
  PRICING_TYPE_OPTIONS,
  IMPORTANCE_OPTIONS,
  REACTIVITY_NEED_OPTIONS,
  CALCULATION_ON_OPTIONS,
  PERIOD_TYPE_OPTIONS,
  CALCULATION_MODE_OPTIONS,
  DISPLAY_TREND_OPTIONS,
  REGRESSION_OPTIONS,
  TARGET_AUTO_ADJUSTMENT_OPTIONS,
  TOLERANCE_TYPE_OPTIONS,
} from "../../../constants/kpiOptions";
import { Field, Modal, SectionTitle, inputClass } from "./ui.jsx";
import {
  formatToleranceForInput,
  inferValueType,
  normalizeLimitInput,
  normalizeNullableFieldValue,
  recalculateLimits,
  serializeToleranceForPayload,
} from "./formatting.js";

const KPI_FILE_UPLOAD_MAX_SIZE = 20 * 1024 * 1024;

// resetForm() + openCreateModal() of the original script, merged.
export const KPI_CREATE_DEFAULTS = Object.freeze({
  kpi_id: "",
  kfs: "KPI",
  indicator_sub_title: "",
  subject: "",
  kpi_code: "",
  kpi_formula: "",
  unit: "kCur",
  frequency: "Weekly",
  target_direction: "Up",
  min_type: "0",
  min: "0",
  max_type: "0",
  max: "0",
  reactivity_status: "Anticipated",
  pricing_type: "Operational",
  importance: "Medium",
  reactivity_need: "Urgent",
  calculation_on: "Value",
  period_type: "",
  nombre_periode: "",
  calculation_mode: "Direct",
  reference_kpi_id: "",
  display_trend: "No",
  regression: "",
  target_auto_adjustment: "Yes",
  definition: "",
  tolerance_type: "",
  high_limit: "",
  low_limit: "",
  up_tolerance: "",
  low_tolerance: "",
  target: "",
  status: "Active",
  comments: "",
  owner_role_id: "",
  file_url: "",
  file_name: "",
});

// Real rows can carry values outside the "official" option list; keep the
// current value selectable so editing never silently rewrites it.
function withCurrentValue(options, current) {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

function formatKpiFileSize(size) {
  const numericSize = Number(size);
  if (!Number.isFinite(numericSize) || numericSize < 0) return "";
  if (numericSize < 1024) return `${numericSize} B`;
  if (numericSize < 1024 * 1024) return `${(numericSize / 1024).toFixed(1)} KB`;
  return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const marker = "base64,";
      const markerIndex = result.indexOf(marker);
      if (markerIndex === -1) {
        reject(new Error("Failed to encode the selected file."));
        return;
      }
      resolve(result.slice(markerIndex + marker.length));
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read the selected file."));
    reader.readAsDataURL(file);
  });
}

// handlePeriodTypeChange(): "1 week".."4 weeks" or "1 month".."4 months".
function periodCountOptions(periodType) {
  const unit = periodType === "Monthly" ? "month" : "week";
  return [1, 2, 3, 4].map((n) => `${n} ${unit}${n > 1 ? "s" : ""}`);
}

// fillForm() of the original script.
export function kpiRowToForm(data) {
  return {
    ...KPI_CREATE_DEFAULTS,
    kpi_id: data.kpi_id ?? "",
    kfs: data.kfs || "KPI",
    indicator_sub_title: data.indicator_sub_title || "",
    subject: data.full_subject_path || data.subject || data.indicator_title || "",
    kpi_code: data.kpi_code || "",
    kpi_formula: data.kpi_formula || "",
    unit: data.unit || "",
    frequency: data.frequency || "",
    target_direction: data.target_direction || "",
    status: data.status || "Active",
    comments: data.comments || "",
    definition: data.definition || "",
    calculation_on: data.calculation_on || "",
    period_type:
      data.calculation_on === "Average"
        ? String(data.nombre_periode || "").includes("month")
          ? "Monthly"
          : "Weekly"
        : "",
    nombre_periode: data.nombre_periode || "",
    calculation_mode: data.calculation_mode || "Direct",
    reference_kpi_id: data.reference_kpi_id ?? "",
    owner_role_id: data.owner_role_id ?? "",
    display_trend: data.display_trend || "",
    regression: data.regression || "",
    target: data.target ?? "",
    target_auto_adjustment: data.target_auto_adjustment || "",
    reactivity_status: data.reactivity_status || "",
    importance: data.importance || "",
    pricing_type: data.pricing_type || "",
    reactivity_need: data.reactivity_need || "",
    min_type: data.min_type || inferValueType(data.min),
    max_type: data.max_type || inferValueType(data.max),
    min: normalizeNullableFieldValue(data.min),
    max: normalizeNullableFieldValue(data.max),
    tolerance_type: data.tolerance_type || "",
    up_tolerance: formatToleranceForInput(data.up_tolerance, data.tolerance_type, "up"),
    low_tolerance: formatToleranceForInput(data.low_tolerance, data.tolerance_type, "low"),
    high_limit: data.high_limit ?? "",
    low_limit: data.low_limit ?? "",
    file_url: data.file_url || "",
    file_name: data.file_name || "",
  };
}

// validateKpiForm() of the original script. The "Select the final subject from
// the tree" check becomes a non-empty subject text check (the tree picker is
// simplified to a text field matched server-side by name / full path).
export function validateKpiForm(form) {
  const validations = [
    { valid: Boolean(form.subject), message: "Subject is required." },
    { valid: Boolean(form.indicator_sub_title), message: "KPI Name is required." },
    { valid: Boolean(form.unit), message: "Unit is required." },
    { valid: Boolean(form.frequency), message: "Frequency is required." },
    { valid: Boolean(form.target_direction), message: "Direction is required." },
    { valid: Boolean(form.calculation_on), message: "Calculation On is required." },
    { valid: Boolean(form.calculation_mode), message: "Calculation Mode is required." },
    { valid: Boolean(form.display_trend), message: "Display Trend is required." },
    { valid: Boolean(form.min_type), message: "Min is required." },
    { valid: Boolean(form.max_type), message: "Max is required." },
    { valid: Boolean(form.target_auto_adjustment), message: "Target Auto Adjust is required." },
    { valid: Boolean(form.definition), message: "Definition is required." },
    { valid: Boolean(form.tolerance_type), message: "Tolerance Type is required." },
  ];

  if (form.calculation_on === "Average") {
    validations.push({ valid: Boolean(form.nombre_periode), message: "Nombre periode is required." });
  }
  if (form.calculation_mode === "Ratio") {
    validations.push({
      valid: Boolean(form.reference_kpi_id),
      message: "Reference KPI is required for Ratio mode.",
    });
  }
  if (form.display_trend === "Yes") {
    validations.push({
      valid: Boolean(form.regression),
      message: "Regression is required when Display Trend is Yes.",
    });
  }
  if (form.min_type === "Valeur a entrer") {
    validations.push({ valid: Boolean(form.min), message: "Min Value is required." });
    validations.push({
      valid: !form.min || normalizeLimitInput(form.min) !== null,
      message: "Min Value must be numeric.",
    });
  }
  if (form.max_type === "Valeur a entrer") {
    validations.push({ valid: Boolean(form.max), message: "Max Value is required." });
    validations.push({
      valid: !form.max || normalizeLimitInput(form.max) !== null,
      message: "Max Value must be numeric.",
    });
  }

  if (String(form.tolerance_type || "").toLowerCase() === "absolute") {
    validations.push({ valid: Boolean(form.high_limit), message: "High Limit is required." });
    validations.push({
      valid: !form.high_limit || normalizeLimitInput(form.high_limit) !== null,
      message: "High Limit must be numeric.",
    });
    validations.push({ valid: Boolean(form.low_limit), message: "Low Limit is required." });
    validations.push({
      valid: !form.low_limit || normalizeLimitInput(form.low_limit) !== null,
      message: "Low Limit must be numeric.",
    });
  } else {
    validations.push({ valid: Boolean(form.up_tolerance), message: "Up Tolerance is required." });
    validations.push({
      valid: !form.up_tolerance || normalizeLimitInput(form.up_tolerance, true) !== null,
      message: "Up Tolerance must be numeric.",
    });
    validations.push({ valid: Boolean(form.low_tolerance), message: "Low Tolerance is required." });
    validations.push({
      valid: !form.low_tolerance || normalizeLimitInput(form.low_tolerance, true) !== null,
      message: "Low Tolerance must be numeric.",
    });
  }

  return validations.find((entry) => !entry.valid)?.message || null;
}

// buildPayload() of the original script. Note indicator_title is deliberately
// sent as the subject text: the original does exactly that
// (`indicator_title: getSafeValue("subject")`), overriding the hidden field.
export async function buildKpiPayload(form, pendingFile) {
  const toleranceType = form.tolerance_type || "";
  const minType = form.min_type || "Null";
  const maxType = form.max_type || "Null";
  const minValue = normalizeNullableFieldValue(form.min);
  const maxValue = normalizeNullableFieldValue(form.max);

  const fileUpload = pendingFile
    ? {
        name: pendingFile.name || "kpi-file",
        type: pendingFile.type || "application/octet-stream",
        size: pendingFile.size || 0,
        content_base64: await readFileAsBase64(pendingFile),
      }
    : null;

  return {
    kfs: form.kfs || "KPI",
    indicator_title: form.subject,
    indicator_sub_title: form.indicator_sub_title,
    subject: form.subject,
    kpi_code: form.kpi_code,
    kpi_formula: form.kpi_formula,
    unit: form.unit,
    definition: form.definition,
    frequency: form.frequency,
    target: form.target,
    tolerance_type: toleranceType,
    up_tolerance: serializeToleranceForPayload(form.up_tolerance, toleranceType, "up"),
    low_tolerance: serializeToleranceForPayload(form.low_tolerance, toleranceType, "low"),
    max: maxType === "Null" ? "" : maxType === "0" ? "0" : maxValue,
    min: minType === "Null" ? "" : minType === "0" ? "0" : minValue,
    calculation_on: form.calculation_on,
    target_auto_adjustment: form.target_auto_adjustment,
    reactivity_status: form.reactivity_status || null,
    importance: form.importance || null,
    pricing_type: form.pricing_type || null,
    reactivity_need: form.reactivity_need || null,
    target_direction: form.target_direction,
    nombre_periode: form.calculation_on === "Average" ? form.nombre_periode : "",
    calculation_mode: form.calculation_mode,
    reference_kpi_id: form.calculation_mode === "Ratio" ? form.reference_kpi_id || null : null,
    display_trend: form.display_trend,
    regression: form.regression,
    min_type: minType,
    max_type: maxType,
    owner_role_id: form.owner_role_id || null,
    status: form.status,
    comments: form.comments,
    high_limit: form.high_limit || null,
    low_limit: form.low_limit || null,
    file_upload: fileUpload,
  };
}

export default function KpiEditorModal({
  form,
  setForm,
  isEdit,
  saving,
  referenceKpiRows,
  roleOptions,
  responsibleName,
  onSave,
  onDelete,
  onClose,
  onToast,
}) {
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  // Keep the pending upload scoped to a single open/close cycle.
  useEffect(() => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [form.kpi_id]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // handleMinTypeChange / handleMaxTypeChange
  const changeMinType = (value) => {
    const patch = { min_type: value };
    if (value === "Null") patch.min = "";
    if (value === "0") patch.min = "0";
    if (value === "Valeur a entrer" && form.min === "0") patch.min = "";
    update(patch);
  };
  const changeMaxType = (value) => {
    const patch = { max_type: value };
    if (value === "Null") patch.max = "";
    if (value === "0") patch.max = "0";
    if (value === "Valeur a entrer" && form.max === "0") patch.max = "";
    update(patch);
  };

  // handleCalculationOnChange / handlePeriodTypeChange
  const changeCalculationOn = (value) => {
    if (value !== "Average") {
      update({ calculation_on: value, period_type: "", nombre_periode: "" });
      return;
    }
    const periodType = form.period_type || "Weekly";
    update({
      calculation_on: value,
      period_type: periodType,
      nombre_periode: periodCountOptions(periodType)[0],
    });
  };
  const changePeriodType = (value) => {
    update({ period_type: value, nombre_periode: periodCountOptions(value)[0] });
  };

  // recalculateLimits() -- relative tolerance recomputes high/low from target.
  const applyRelativeRecalculation = (patch) => {
    const next = { ...form, ...patch };
    const limits = recalculateLimits({
      target: next.target,
      toleranceType: next.tolerance_type,
      upTolerance: next.up_tolerance,
      lowTolerance: next.low_tolerance,
    });
    update(limits ? { ...patch, ...limits } : patch);
  };

  const changeToleranceType = (value) => {
    // syncToleranceInputs(): clear the fields belonging to the other mode so
    // stale values are never submitted, then reformat / recompute.
    const patch = { tolerance_type: value };
    if (value === "Absolute") {
      patch.up_tolerance = "";
      patch.low_tolerance = "";
    } else if (value === "Relative") {
      patch.high_limit = "";
      patch.low_limit = "";
      patch.up_tolerance = formatToleranceForInput(form.up_tolerance, value, "up");
      patch.low_tolerance = formatToleranceForInput(form.low_tolerance, value, "low");
    }
    applyRelativeRecalculation(patch);
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    if (selected && selected.size > KPI_FILE_UPLOAD_MAX_SIZE) {
      onToast("The selected file is too large. Maximum size is 20 MB.");
      event.target.value = "";
      setPendingFile(null);
      return;
    }
    setPendingFile(selected);
  };

  const referenceOptions = useMemo(() => {
    const options = (referenceKpiRows || [])
      .filter((row) => row && row.kpi_id != null && String(row.kpi_id) !== String(form.kpi_id))
      .map((row) => ({
        value: String(row.kpi_id),
        label: String(row.indicator_sub_title || "").trim() || `KPI #${row.kpi_id}`,
      }));

    const selected = String(form.reference_kpi_id || "").trim();
    if (selected && !options.some((option) => option.value === selected)) {
      options.push({ value: selected, label: `#${selected}` });
    }
    return options;
  }, [referenceKpiRows, form.kpi_id, form.reference_kpi_id]);

  return (
    <Modal
      title={isEdit ? "Edit KPI Attributes" : "Add New KPI"}
      subtitle={
        isEdit
          ? "Refine the KPI identity, subject alignment, calculation logic, and tolerance settings in one focused view."
          : `Create a KPI with a clear name, subject branch, measurement logic, and threshold setup for ${responsibleName || "this responsible"}.`
      }
      onClose={onClose}
      footer={
        <>
          {isEdit ? (
            <button
              type="button"
              className="mr-auto rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              Delete KPI
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
            disabled={saving}
            onClick={() => onSave(pendingFile)}
          >
            {saving ? "Saving..." : "Save KPI"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Type">
          <select className={inputClass} value={form.kfs} onChange={(e) => update({ kfs: e.target.value })}>
            {KFS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="KPI Name" required>
            <input
              className={inputClass}
              placeholder="Type or adjust the KPI name"
              value={form.indicator_sub_title}
              onChange={(e) => update({ indicator_sub_title: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <Field
        label="Subject"
        required
        hint="Exact subject name or full hierarchy path"
      >
        <input
          className={inputClass}
          placeholder="e.g. Company Success / Cash generation / EBITDA / Sales"
          value={form.subject}
          onChange={(e) => update({ subject: e.target.value })}
        />
        <span className="text-xs text-slate-400">
          Must match an existing subject name or full hierarchy path exactly (case-insensitive).
        </span>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Unit" required>
          <select className={inputClass} value={form.unit} onChange={(e) => update({ unit: e.target.value })}>
            <option value="">Select Unit</option>
            {withCurrentValue(UNIT_OPTIONS, form.unit).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Frequency" required>
          <select
            className={inputClass}
            value={form.frequency}
            onChange={(e) => update({ frequency: e.target.value })}
          >
            <option value="">Select Frequency</option>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {form.frequency && !FREQUENCY_OPTIONS.some((o) => o.value === form.frequency) ? (
              <option value={form.frequency}>{form.frequency}</option>
            ) : null}
          </select>
        </Field>
        <Field label="Direction" required>
          <select
            className={inputClass}
            value={form.target_direction}
            onChange={(e) => update({ target_direction: e.target.value })}
          >
            <option value="">Select Direction</option>
            {withCurrentValue(DIRECTION_OPTIONS, form.target_direction).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Min" required>
          <select className={inputClass} value={form.min_type} onChange={(e) => changeMinType(e.target.value)}>
            {MIN_MAX_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {form.min_type === "Valeur a entrer" ? (
          <Field label="Min Value" required>
            <input className={inputClass} value={form.min} onChange={(e) => update({ min: e.target.value })} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Max" required>
          <select className={inputClass} value={form.max_type} onChange={(e) => changeMaxType(e.target.value)}>
            {MIN_MAX_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {form.max_type === "Valeur a entrer" ? (
          <Field label="Max Value" required>
            <input className={inputClass} value={form.max} onChange={(e) => update({ max: e.target.value })} />
          </Field>
        ) : (
          <div />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Reactivity Status">
          <select
            className={inputClass}
            value={form.reactivity_status}
            onChange={(e) => update({ reactivity_status: e.target.value })}
          >
            <option value="">Select reactivity status</option>
            {withCurrentValue(REACTIVITY_STATUS_OPTIONS, form.reactivity_status).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pricing Type">
          <select
            className={inputClass}
            value={form.pricing_type}
            onChange={(e) => update({ pricing_type: e.target.value })}
          >
            <option value="">Select pricing type</option>
            {withCurrentValue(PRICING_TYPE_OPTIONS, form.pricing_type).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Importance">
          <select
            className={inputClass}
            value={form.importance}
            onChange={(e) => update({ importance: e.target.value })}
          >
            <option value="">Select importance</option>
            {withCurrentValue(IMPORTANCE_OPTIONS, form.importance).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Need for responsiveness">
          <select
            className={inputClass}
            value={form.reactivity_need}
            onChange={(e) => update({ reactivity_need: e.target.value })}
          >
            <option value="">Select reactivity need</option>
            {withCurrentValue(REACTIVITY_NEED_OPTIONS, form.reactivity_need).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SectionTitle>Calculation logic</SectionTitle>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Calculation On" required>
          <select
            className={inputClass}
            value={form.calculation_on}
            onChange={(e) => changeCalculationOn(e.target.value)}
          >
            <option value="">Select Calculation On</option>
            {withCurrentValue(CALCULATION_ON_OPTIONS, form.calculation_on).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        {form.calculation_on === "Average" ? (
          <>
            <Field label="Period Type">
              <select
                className={inputClass}
                value={form.period_type}
                onChange={(e) => changePeriodType(e.target.value)}
              >
                <option value="">Select period type</option>
                {PERIOD_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of Periods" required>
              <select
                className={inputClass}
                value={form.nombre_periode}
                onChange={(e) => update({ nombre_periode: e.target.value })}
              >
                {withCurrentValue(
                  periodCountOptions(form.period_type || "Weekly"),
                  form.nombre_periode
                ).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Calculation Mode" required>
          <select
            className={inputClass}
            value={form.calculation_mode}
            onChange={(e) => update({ calculation_mode: e.target.value })}
          >
            <option value="">Select calculation mode</option>
            {withCurrentValue(CALCULATION_MODE_OPTIONS, form.calculation_mode).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        {form.calculation_mode === "Ratio" ? (
          <div className="sm:col-span-2">
            <Field label="Reference KPI" required hint="Required for ratio">
              <select
                className={inputClass}
                value={form.reference_kpi_id}
                onChange={(e) => update({ reference_kpi_id: e.target.value })}
              >
                <option value="">Select reference KPI</option>
                {referenceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">
                Displayed KPI = Raw value /{" "}
                {referenceOptions.find((o) => o.value === String(form.reference_kpi_id))?.label ||
                  "Reference KPI"}{" "}
                x 100
              </span>
            </Field>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Display Trend" required>
          <select
            className={inputClass}
            value={form.display_trend}
            onChange={(e) =>
              update({ display_trend: e.target.value, regression: e.target.value === "Yes" ? form.regression || "1 week" : form.regression })
            }
          >
            <option value="">Select display trend</option>
            {withCurrentValue(DISPLAY_TREND_OPTIONS, form.display_trend).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        {form.display_trend === "Yes" ? (
          <Field label="Periods of Regression" required hint="Weeks">
            <select
              className={inputClass}
              value={form.regression}
              onChange={(e) => update({ regression: e.target.value })}
            >
              {withCurrentValue(REGRESSION_OPTIONS, form.regression).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Target Auto Adjust" required>
          <select
            className={inputClass}
            value={form.target_auto_adjustment}
            onChange={(e) => update({ target_auto_adjustment: e.target.value })}
          >
            {withCurrentValue(TARGET_AUTO_ADJUSTMENT_OPTIONS, form.target_auto_adjustment).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {roleOptions?.length ? (
        <Field label="Owner Role" hint="Optional">
          <select
            className={inputClass}
            value={form.owner_role_id ?? ""}
            onChange={(e) => update({ owner_role_id: e.target.value })}
          >
            <option value="">No owner role</option>
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Definition" required hint="Explain clearly">
        <textarea
          className={`${inputClass} min-h-[110px]`}
          placeholder="Write a clear KPI definition..."
          value={form.definition}
          onChange={(e) => update({ definition: e.target.value })}
        />
      </Field>

      <Field label="KPI File" hint="Upload any file type (max 20 MB)">
        <input ref={fileInputRef} type="file" className={inputClass} onChange={handleFileChange} />
        {form.file_url ? (
          <span className="mt-1 text-xs text-slate-500">
            Current file:{" "}
            <a
              className="break-all text-blue-600 underline"
              href={form.file_url}
              target="_blank"
              rel="noopener noreferrer"
              download={form.file_name || undefined}
            >
              {form.file_name || form.file_url}
            </a>
          </span>
        ) : null}
        {pendingFile ? (
          <span className="mt-1 text-xs text-slate-500">
            Selected file: {pendingFile.name} ({formatKpiFileSize(pendingFile.size)})
          </span>
        ) : null}
      </Field>

      <SectionTitle>Tolerance</SectionTitle>
      <div className="flex flex-wrap gap-6">
        {TOLERANCE_TYPE_OPTIONS.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="radio"
              name="responsible_tolerance_type_radio"
              value={o}
              checked={form.tolerance_type === o}
              onChange={() => changeToleranceType(o)}
            />
            {o}
          </label>
        ))}
      </div>

      {form.tolerance_type === "Absolute" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="High Limit" required>
            <input
              className={inputClass}
              type="number"
              step="any"
              placeholder="e.g. 544.5"
              value={form.high_limit}
              onChange={(e) => update({ high_limit: e.target.value })}
            />
          </Field>
          <Field label="Low Limit" required>
            <input
              className={inputClass}
              type="number"
              step="any"
              placeholder="e.g. 445.5"
              value={form.low_limit}
              onChange={(e) => update({ low_limit: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {form.tolerance_type === "Relative" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Up Tolerance" required>
            <input
              className={inputClass}
              placeholder="+10%"
              value={form.up_tolerance}
              onChange={(e) => applyRelativeRecalculation({ up_tolerance: e.target.value })}
            />
          </Field>
          <Field label="Low Tolerance" required>
            <input
              className={inputClass}
              placeholder="-10%"
              value={form.low_tolerance}
              onChange={(e) => applyRelativeRecalculation({ low_tolerance: e.target.value })}
            />
          </Field>
          <Field label="High Limit" hint="Computed">
            <input className={inputClass} value={form.high_limit} readOnly />
          </Field>
          <Field label="Low Limit" hint="Computed">
            <input className={inputClass} value={form.low_limit} readOnly />
          </Field>
        </div>
      ) : null}
    </Modal>
  );
}

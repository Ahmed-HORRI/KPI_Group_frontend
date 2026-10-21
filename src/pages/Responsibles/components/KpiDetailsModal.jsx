import { Modal } from "./ui.jsx";
import { formatKpiDetailNumber, formatKpiDetailTimestamp } from "./formatting.js";

// Read-only KPI consult view -- port of renderKpiDetailsModalContent() from the
// original page's script. Sections are omitted entirely when all their fields
// are empty, exactly like the original.

function hasValue(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== "" && s !== "-" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined";
}

function fmtNum(v, unit) {
  const r = formatKpiDetailNumber(v, unit || "");
  return hasValue(r) && r !== "-" ? r : "";
}

function fmtTolerance(value) {
  if (!hasValue(value)) return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const pct = Math.abs(num) <= 1 ? num * 100 : num;
  return `${parseFloat(pct.toFixed(4))}%`;
}

function DetailSection({ label, fields }) {
  const visible = fields.filter((f) => hasValue(f.value) || f.node);
  if (!visible.length) return null;

  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((f) => (
          <div
            key={f.label}
            className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40"
          >
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {f.label}
            </div>
            <div className="mt-0.5 break-words text-sm font-semibold text-slate-800 dark:text-white">
              {f.node || String(f.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KpiDetailsModal({ kpi, onClose }) {
  const unit = kpi.unit || "";
  const minTypeRaw = String(kpi.min_type || "").trim().toLowerCase();
  const maxTypeRaw = String(kpi.max_type || "").trim().toLowerCase();
  const showMin = minTypeRaw !== "" && minTypeRaw !== "null";
  const showMax = maxTypeRaw !== "" && maxTypeRaw !== "null";
  const isRelative = String(kpi.tolerance_type || "").trim().toLowerCase() === "relative";
  const fileUrl = String(kpi.file_url || "").trim();
  const fileName = String(kpi.file_name || "").trim();
  const definition = String(kpi.definition || "").trim();

  return (
    <Modal
      title="KPI Details"
      subtitle="Consult the full KPI definition, thresholds, and calculation logic in a focused read-only view."
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <DetailSection
        label="Identity"
        fields={[
          { label: "KPI Name", value: kpi.indicator_sub_title },
          { label: "Subject", value: kpi.full_subject_path || kpi.subject },
          { label: "KPI Code", value: kpi.kpi_code },
          { label: "Formula", value: kpi.kpi_formula },
        ]}
      />
      <DetailSection
        label="Measurement"
        fields={[
          { label: "Unit", value: kpi.unit },
          { label: "Frequency", value: kpi.frequency },
          { label: "Direction", value: kpi.target_direction },
          { label: "Target", value: fmtNum(kpi.target, unit) },
          { label: "Target Auto Adjust", value: kpi.target_auto_adjustment },
        ]}
      />
      <DetailSection
        label="Priority"
        fields={[
          { label: "Reactivity Status", value: kpi.reactivity_status },
          { label: "Pricing Type", value: kpi.pricing_type },
          { label: "Importance", value: kpi.importance },
          { label: "Reactivity Need", value: kpi.reactivity_need },
        ]}
      />
      <DetailSection
        label="Calculation"
        fields={[
          { label: "Calculation On", value: kpi.calculation_on },
          { label: "Calculation Mode", value: kpi.calculation_mode },
          { label: "Reference KPI", value: kpi.reference_kpi_id ? `KPI #${kpi.reference_kpi_id}` : "" },
          { label: "Display Trend", value: kpi.display_trend },
          { label: "Regression", value: kpi.regression },
          { label: "Periods", value: kpi.nombre_periode },
        ]}
      />
      <DetailSection
        label="Range"
        fields={[
          {
            label: "Min Type",
            value: showMin ? (minTypeRaw === "valeur a entrer" ? "Value" : kpi.min_type) : "",
          },
          { label: "Min Value", value: showMin ? fmtNum(kpi.min, unit) : "" },
          {
            label: "Max Type",
            value: showMax ? (maxTypeRaw === "valeur a entrer" ? "Value" : kpi.max_type) : "",
          },
          { label: "Max Value", value: showMax ? fmtNum(kpi.max, unit) : "" },
        ]}
      />
      <DetailSection
        label="Tolerance"
        fields={[
          { label: "Tolerance Type", value: kpi.tolerance_type },
          {
            label: "Up Tolerance",
            value: isRelative ? fmtTolerance(kpi.up_tolerance) : fmtNum(kpi.up_tolerance, unit),
          },
          {
            label: "Low Tolerance",
            value: isRelative ? fmtTolerance(kpi.low_tolerance) : fmtNum(kpi.low_tolerance, unit),
          },
          { label: "High Limit", value: fmtNum(kpi.high_limit, unit) },
          { label: "Low Limit", value: fmtNum(kpi.low_limit, unit) },
        ]}
      />
      <DetailSection
        label="Timeline"
        fields={[
          { label: "Created At", value: formatKpiDetailTimestamp(kpi.created_at) },
          { label: "Updated At", value: formatKpiDetailTimestamp(kpi.updated_at) },
          { label: "Owner Role ID", value: kpi.owner_role_id ? String(kpi.owner_role_id) : "" },
          { label: "Target", value: fmtNum(kpi.target, unit) },
        ]}
      />
      {fileUrl ? (
        <DetailSection
          label="Attachment"
          fields={[
            { label: "File Name", value: fileName },
            {
              label: "File",
              value: fileUrl,
              node: (
                <a
                  className="break-all text-blue-600 underline dark:text-blue-400"
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  {fileName || fileUrl}
                </a>
              ),
            },
          ]}
        />
      ) : null}
      {definition ? (
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Definition</div>
          <div className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            {definition}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

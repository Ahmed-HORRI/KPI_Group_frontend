export const KFS_OPTIONS = ["KPI", "KFS"];

export const UNIT_OPTIONS = ["kCur", "%", "EA", "PPM", "Number"];

export const FREQUENCY_OPTIONS = [
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "By Weekly", label: "BI Weekly" },
  { value: "Monthly", label: "Monthly" },
  { value: "By Monthly", label: "BI Monthly" },
  { value: "Yearly", label: "Yearly" },
  { value: "By Yearly", label: "BI Yearly" },
];

export const DIRECTION_OPTIONS = ["Up", "Down"];

export const MIN_MAX_TYPE_OPTIONS = [
  { value: "Null", label: "Null" },
  { value: "0", label: "0" },
  { value: "Valeur a entrer", label: "Value" },
];

export const REACTIVITY_STATUS_OPTIONS = ["Anticipated", "Reactive"];
export const PRICING_TYPE_OPTIONS = ["Operational", "Selling"];
export const IMPORTANCE_OPTIONS = ["High", "Medium", "Low"];
export const REACTIVITY_NEED_OPTIONS = ["Urgent", "Not Urgent"];

export const CALCULATION_ON_OPTIONS = ["Value", "Average"];
export const PERIOD_TYPE_OPTIONS = ["Weekly", "Monthly"];
export const CALCULATION_MODE_OPTIONS = ["Direct", "Ratio"];
export const DISPLAY_TREND_OPTIONS = ["No", "Yes"];
export const REGRESSION_OPTIONS = ["1 week", "2 weeks", "3 weeks", "4 weeks"];
export const TARGET_AUTO_ADJUSTMENT_OPTIONS = ["Yes", "No"];
export const TOLERANCE_TYPE_OPTIONS = ["Absolute", "Relative"];

export const KPI_FORM_DEFAULTS = {
  kfs: "KPI",
  indicator_title: "",
  indicator_sub_title: "",
  subject: "",
  unit: "kCur",
  frequency: "",
  target_direction: "",
  min_type: "Null",
  max_type: "Null",
  min: "",
  max: "",
  reactivity_status: "",
  pricing_type: "",
  importance: "",
  reactivity_need: "",
  calculation_on: "",
  period_type: "",
  nombre_periode: "",
  calculation_mode: "",
  reference_kpi_id: "",
  display_trend: "",
  regression: "1 week",
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
};

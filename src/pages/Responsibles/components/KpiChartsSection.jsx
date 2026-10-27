import { useEffect, useMemo, useState } from "react";
import { Chart } from "react-chartjs-2";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import apiClient, { getApiErrorMessage } from "../../../api/client";
import SelectMenu from "../../../components/SelectMenu.jsx";
import { useChartColors } from "../../../theme/chartColors.js";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ChartIcon,
  FactoryIcon,
  GlobeIcon,
  UserIcon,
} from "../../../components/icons.jsx";
import { EmptyState, StatTile } from "./ui.jsx";

ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

// Colors (theme/chartColors.js): bars in the status colors -- reserved for
// good/critical state, never reused as a categorical series color -- the
// target in AVO blue, both limits in GROUP orange (the high one always sits
// above the low one, and the legend and chips name them).

// Port of the original page's "My KPI Analytics" section (loadKpiCharts).
//
// Data source: the original called GET /api/responsibles/:id/kpi-history-monthly,
// whose SQL reads public.kpi_values_hist26 JOIN public."Kpi" -- both tables are
// confirmed absent from the current database, so the section has always rendered
// "No KPI history found for this responsible." This uses the live replacement
// endpoint GET /api/responsibles/:id/kpi-monthly-series (same response shape,
// built from kpi_result + kpi_target_allocation + kpi).
//
// The decorative "flow line" canvas overlay of the original is not reproduced;
// the threshold band shading is.

function normalizeChartLimitValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeChartDirection(direction) {
  return String(direction || "").trim().toLowerCase() === "down" ? "down" : "up";
}

// true when the value is out of its limits, null without a value.
function isChartValueBad(value, lowLimit, highLimit, direction) {
  const numericValue = normalizeChartLimitValue(value);
  const low = normalizeChartLimitValue(lowLimit);
  const high = normalizeChartLimitValue(highLimit);
  const resolvedDirection = normalizeChartDirection(direction);

  if (numericValue === null) return null;

  const lowerBound = low !== null && high !== null ? Math.min(low, high) : low;
  const upperBound = low !== null && high !== null ? Math.max(low, high) : high;
  const isBelowLower = lowerBound !== null && numericValue < lowerBound;
  const isAboveUpper = upperBound !== null && numericValue > upperBound;
  return resolvedDirection === "down" ? isAboveUpper : isBelowLower;
}

function getChartValueBandColor(value, lowLimit, highLimit, direction, colors) {
  const isBad = isChartValueBad(value, lowLimit, highLimit, direction);
  if (isBad === null) return colors.missing;
  return isBad ? colors.critical : colors.good;
}

const kpiThresholdBandsPlugin = {
  id: "kpiThresholdBands",
  beforeDatasetsDraw(chart, args, pluginOptions) {
    const low = normalizeChartLimitValue(pluginOptions?.lowLimit);
    const high = normalizeChartLimitValue(pluginOptions?.highLimit);
    const yScale = chart.scales?.y;
    const area = chart.chartArea;
    if (!yScale || !area || (low === null && high === null)) return;

    const lowerBound = low !== null && high !== null ? Math.min(low, high) : low;
    const upperBound = low !== null && high !== null ? Math.max(low, high) : high;

    const drawBand = (fromValue, toValue, fillStyle) => {
      if (fromValue === null || toValue === null) return;
      const startY = yScale.getPixelForValue(fromValue);
      const endY = yScale.getPixelForValue(toValue);
      if (!Number.isFinite(startY) || !Number.isFinite(endY)) return;
      const top = Math.min(startY, endY);
      const height = Math.abs(endY - startY);
      if (!height) return;
      chart.ctx.fillStyle = fillStyle;
      chart.ctx.fillRect(area.left, top, area.right - area.left, height);
    };

    chart.ctx.save();
    chart.ctx.beginPath();
    chart.ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    chart.ctx.clip();

    const BAND_CRITICAL = "rgba(208, 59, 59, 0.08)";
    const BAND_GOOD = "rgba(12, 163, 12, 0.08)";

    if (lowerBound !== null && upperBound !== null) {
      drawBand(yScale.max, upperBound, BAND_CRITICAL);
      drawBand(upperBound, lowerBound, BAND_GOOD);
      drawBand(lowerBound, yScale.min, BAND_CRITICAL);
    } else if (upperBound !== null) {
      drawBand(yScale.max, upperBound, BAND_CRITICAL);
      drawBand(upperBound, yScale.min, BAND_GOOD);
    } else if (lowerBound !== null) {
      drawBand(yScale.max, lowerBound, BAND_GOOD);
      drawBand(lowerBound, yScale.min, BAND_CRITICAL);
    }

    chart.ctx.restore();
  },
};

function KpiChartCard({ row }) {
  const colors = useChartColors();
  const sourceLabels = Array.isArray(row.labels) ? row.labels : [];
  const periodLabels = sourceLabels.map((_, index) => `Period ${index + 1}`);
  const values = Array.isArray(row.values) ? row.values : [];

  const targetSeries = sourceLabels.map(() => row.targetValue ?? null);
  const highLimitSeries = sourceLabels.map(() => row.highLimitValue ?? null);
  const lowLimitSeries = sourceLabels.map(() => row.lowLimitValue ?? null);

  const barColors = values.map((value) =>
    getChartValueBandColor(value, row.lowLimitValue, row.highLimitValue, row.targetDirection, colors)
  );

  const axisValues = [...values, ...targetSeries, ...highLimitSeries, ...lowLimitSeries]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);

  const axisSourceMin = axisValues.length ? Math.min(...axisValues) : 0;
  const axisSourceMax = axisValues.length ? Math.max(...axisValues) : 100;

  let axisMin = axisSourceMin > 0 ? axisSourceMin * 0.8 : axisSourceMin < 0 ? axisSourceMin * 1.2 : 0;
  let axisMax = axisSourceMax > 0 ? axisSourceMax * 1.2 : axisSourceMax < 0 ? axisSourceMax * 0.8 : 0;
  if (axisSourceMin === axisSourceMax) {
    const pad = Math.max(Math.abs(axisSourceMax || axisSourceMin || 1) * 0.2, 1);
    axisMin = axisSourceMin - pad;
    axisMax = axisSourceMax + pad;
  }

  const data = {
    labels: periodLabels,
    datasets: [
      {
        type: "bar",
        label: "Actual Value",
        data: values,
        borderWidth: 1,
        borderColor: barColors,
        backgroundColor: barColors,
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 26,
      },
      {
        // AVO blue -- deliberately not red/green, which are reserved for the
        // bar's good/critical status coloring above.
        type: "line",
        label: "Target",
        data: targetSeries,
        borderColor: colors.target,
        borderWidth: 2,
        tension: 0,
        fill: false,
        pointRadius: 0,
        borderDash: [6, 4],
      },
      {
        type: "line",
        label: "High Limit",
        data: highLimitSeries,
        borderColor: colors.limit,
        borderWidth: 2,
        tension: 0,
        fill: false,
        pointRadius: 0,
        borderDash: [8, 5],
      },
      {
        type: "line",
        label: "Low Limit",
        data: lowLimitSeries,
        borderColor: colors.limit,
        borderWidth: 2,
        tension: 0,
        fill: false,
        pointRadius: 0,
        borderDash: [8, 5],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      kpiThresholdBands: {
        lowLimit: row.lowLimitValue,
        highLimit: row.highLimitValue,
        direction: row.targetDirection,
      },
      // 4 series on this chart -- a legend must always be present (never
      // color-alone identity). Selective direct labels aren't practical on a
      // dense monthly bar chart, so the legend carries identity here.
      legend: {
        display: true,
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          color: colors.legend,
          font: { size: 11, weight: "600" },
          filter: (item) => item.text !== "Actual Value",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: (items) => periodLabels[items?.[0]?.dataIndex ?? 0] || "",
          footer: (items) => {
            const index = items?.[0]?.dataIndex ?? 0;
            return sourceLabels[index] ? `Source: ${sourceLabels[index]}` : "";
          },
        },
      },
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    scales: {
      x: {
        title: {
          display: true,
          text: "Period",
          color: colors.title,
          font: { size: 13, weight: "700" },
        },
        grid: { display: false },
        ticks: { color: colors.text },
      },
      y: {
        beginAtZero: false,
        min: axisMin,
        max: axisMax,
        title: {
          display: true,
          text: "Value",
          color: colors.title,
          font: { size: 13, weight: "700" },
        },
        ticks: { color: colors.text },
        grid: { color: colors.grid },
      },
    },
  };

  const latestValue = values.length ? values[values.length - 1] : null;
  const latestIsBad =
    latestValue !== null &&
    isChartValueBad(latestValue, row.lowLimitValue, row.highLimitValue, row.targetDirection) === true;

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
            {row.indicator_title || "Untitled KPI"}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
            {row.indicator_sub_title || "Monthly KPI history"}
          </p>
        </div>
        {latestValue !== null ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
              latestIsBad
                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                : "bg-green-500/10 text-green-700 dark:text-green-300"
            }`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: latestIsBad ? colors.critical : colors.good }}
            />
            {latestIsBad ? "Off target" : "On target"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 px-5 pt-4 text-xs font-bold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-500" />
          Target: {row.targetValue ?? "-"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 dark:bg-orange-600" />
          High Limit: {row.highLimitValue ?? "-"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 dark:bg-orange-600" />
          Low Limit: {row.lowLimitValue ?? "-"}
        </span>
      </div>

      <div className="mt-1 h-64 px-3 pb-3">
        <Chart type="bar" data={data} options={options} plugins={[kpiThresholdBandsPlugin]} />
      </div>
    </div>
  );
}

// Charts are added by pages of this size: "everyone" can mean 400+ charts.
const PAGE_SIZE = 24;

const OWN_FILTERS = { level: "own", scope_units: [], units: [], responsibles: [] };

// Consecutive rows of the same responsible, in the server's order (unit, name).
function groupByResponsible(rows) {
  const groups = [];
  rows.forEach((row) => {
    const last = groups[groups.length - 1];
    if (last && last.responsibleId === row.responsible_id) last.rows.push(row);
    else groups.push({ responsibleId: row.responsible_id, name: row.responsible_name, unit: row.unit_name, rows: [row] });
  });
  return groups;
}

// Shortest period first; anything else after these, alphabetically.
const FREQUENCY_ORDER = ["daily", "weekly", "monthly", "quarterly", "yearly"];

// The frequencies of the loaded KPIs, with how many charts each has. The
// selected one stays listed (at 0) when the new selection has none of it.
function buildFrequencyOptions(rows, selectedFrequency) {
  const counts = new Map();
  rows.forEach((row) => {
    if (row.frequency) counts.set(row.frequency, (counts.get(row.frequency) || 0) + 1);
  });
  if (selectedFrequency && !counts.has(selectedFrequency)) counts.set(selectedFrequency, 0);

  const rank = (frequency) => {
    const index = FREQUENCY_ORDER.indexOf(frequency.toLowerCase());
    return index === -1 ? FREQUENCY_ORDER.length : index;
  };
  const frequencies = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  return [
    { value: "", label: "All frequencies", description: String(rows.length) },
    ...frequencies.map((frequency) => ({
      value: frequency,
      label: frequency,
      description: String(counts.get(frequency)),
    })),
  ];
}

// "My KPI Analytics". Everyone sees their own KPIs and can narrow them by
// frequency; CEO, VP, plant / zone managers and administrators can also pick a
// unit and a responsible of their scope (the server decides the scope and
// enforces it).
export default function KpiChartsSection({ responsibleId }) {
  const [filters, setFilters] = useState(null);
  const [unitId, setUnitId] = useState("");
  const [selected, setSelected] = useState("me"); // "me" | "all" | people_id
  const [frequency, setFrequency] = useState(""); // "" = all frequencies
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get(`/api/responsibles/${responsibleId}/kpi-analytics-filters`)
      .then((res) => {
        if (!cancelled) setFilters(res.data || OWN_FILTERS);
      })
      .catch(() => {
        if (!cancelled) setFilters(OWN_FILTERS);
      });
    return () => {
      cancelled = true;
    };
  }, [responsibleId]);

  // The unit only narrows "all responsibles"; "my KPIs" ignores it.
  const query = selected === "me" ? null : { responsible: selected, unit_id: unitId || undefined };
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiClient
      .get(`/api/responsibles/${responsibleId}/kpi-monthly-series`, { params: JSON.parse(queryKey) || {} })
      .then((res) => {
        if (cancelled) return;
        setRows(Array.isArray(res.data) ? res.data : []);
        setVisibleCount(PAGE_SIZE);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Failed to load KPI charts."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [responsibleId, queryKey]);

  const ownerId = Number(responsibleId);
  const canFilter = Boolean(filters) && filters.level !== "own";
  const unitName = filters?.units.find((unit) => String(unit.unit_id) === unitId)?.unit_name || "";
  const peopleInUnit = (filters?.responsibles || []).filter((person) => !unitId || String(person.unit_id) === unitId);

  const unitOptions = [
    { value: "", label: "All units" },
    ...(filters?.units || []).map((unit) => ({ value: String(unit.unit_id), label: unit.unit_name })),
  ];
  // "My KPIs" and "all", then the people of the unit(s), grouped by unit.
  const responsibleChoices = [
    { value: "me", label: "My KPIs" },
    {
      value: "all",
      label: unitName ? `All responsibles in ${unitName}` : "All responsibles",
      description: String(peopleInUnit.length),
    },
    ...peopleInUnit
      .filter((person) => person.people_id !== ownerId)
      .map((person) => ({ value: String(person.people_id), label: person.full_name, group: person.unit_name || "Other" })),
  ];
  const selectedPerson = filters?.responsibles.find((person) => String(person.people_id) === selected);

  const changeUnit = (value) => {
    setUnitId(value);
    if (selected === "me") {
      // Picking a unit means browsing its responsibles.
      if (value) setSelected("all");
    } else if (selected !== "all" && value && String(selectedPerson?.unit_id) !== value) {
      // The selected responsible is not in that unit.
      setSelected("all");
    }
  };

  const changeResponsible = (value) => {
    setSelected(value);
    if (value === "me") setUnitId("");
  };

  // Filtered here: every series of the selection is already loaded.
  const frequencyOptions = buildFrequencyOptions(rows, frequency);
  const filteredRows = useMemo(
    () => (frequency ? rows.filter((row) => row.frequency === frequency) : rows),
    [rows, frequency]
  );

  const changeFrequency = (value) => {
    setFrequency(value);
    setVisibleCount(PAGE_SIZE);
  };

  const stats = useMemo(() => {
    let onTarget = 0;
    let offTarget = 0;
    let noReading = 0;
    filteredRows.forEach((row) => {
      const values = Array.isArray(row.values) ? row.values : [];
      const latest = values.length ? values[values.length - 1] : null;
      if (latest === null || latest === undefined || latest === "") {
        noReading += 1;
        return;
      }
      if (isChartValueBad(latest, row.lowLimitValue, row.highLimitValue, row.targetDirection)) offTarget += 1;
      else onTarget += 1;
    });
    return { total: filteredRows.length, onTarget, offTarget, noReading };
  }, [filteredRows]);

  const responsibleCount = new Set(filteredRows.map((row) => row.responsible_id)).size;
  // "weekly KPI values", "monthly KPI values", or just "KPI values".
  const kpiValues = `${frequency ? `${frequency.toLowerCase()} ` : ""}KPI values`;
  const subtitle =
    selected === "me"
      ? `Visual trends of ${kpiValues} by month for this responsible.`
      : selected === "all"
        ? `Visual trends of ${kpiValues} by month for ${responsibleCount} responsible${responsibleCount === 1 ? "" : "s"}${
            unitName ? ` in ${unitName}` : ""
          }.`
        : `Visual trends of ${kpiValues} by month for ${selectedPerson?.full_name || "this responsible"}.`;

  const scopeLabel =
    filters?.level === "all"
      ? "All responsibles"
      : filters?.scope_units.map((unit) => unit.unit_name).join(", ") || "";

  // Several responsibles: one heading per responsible above their charts.
  const showOwners = selected === "all";
  const visibleRows = filteredRows.slice(0, visibleCount);
  const remaining = filteredRows.length - visibleRows.length;

  return (
    <section>
      <div className="relative mb-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-orange-200/40 blur-3xl dark:bg-orange-500/10" />
          <div className="absolute -top-24 right-48 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/10" />
        </div>

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative h-12 w-12 shrink-0">
              <span aria-hidden="true" className="absolute inset-x-2 top-4 -bottom-1.5 rounded-2xl bg-emerald-500/35 blur-md" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-emerald-100 text-emerald-600 shadow-sm ring-1 ring-emerald-600/20 dark:from-slate-800 dark:to-emerald-950 dark:text-emerald-400 dark:ring-emerald-500/25">
                <ChartIcon size={22} />
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">My KPI Analytics</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>
          {canFilter && scopeLabel ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
              <GlobeIcon size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-700/80 dark:text-emerald-300/80">Scope</span>
              <span className="truncate font-semibold text-emerald-800 dark:text-emerald-200">{scopeLabel}</span>
            </span>
          ) : null}
        </div>

        {/* Waits for the scope so the bar does not grow once it is known. */}
        {filters ? (
          <div className="relative mt-6">
            <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-slate-50/80 p-2 ring-1 ring-inset ring-slate-200/70 sm:inline-flex sm:w-auto sm:max-w-full dark:bg-slate-800/40 dark:ring-slate-700/60">
              {canFilter ? (
                <>
                  <SelectMenu
                    icon={FactoryIcon}
                    label="Unit"
                    value={unitId}
                    options={unitOptions}
                    onChange={changeUnit}
                    searchable={unitOptions.length > 8}
                    searchPlaceholder="Search a unit..."
                    className="w-full sm:w-auto"
                  />
                  <SelectMenu
                    icon={UserIcon}
                    label="Responsible"
                    value={selected}
                    options={responsibleChoices}
                    onChange={changeResponsible}
                    searchable={responsibleChoices.length > 8}
                    searchPlaceholder="Search a responsible..."
                    className="w-full sm:w-auto"
                  />
                </>
              ) : null}
              <SelectMenu
                icon={CalendarIcon}
                label="Frequency"
                value={frequency}
                options={frequencyOptions}
                onChange={changeFrequency}
                active={Boolean(frequency)}
                className="w-full sm:w-auto"
              />
              {canFilter && selected !== "me" ? (
                <button
                  type="button"
                  onClick={() => changeResponsible("me")}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-blue-600 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 dark:text-blue-400 dark:hover:bg-slate-800"
                >
                  <ArrowLeftIcon size={16} /> Back to my KPIs
                </button>
              ) : null}
            </div>
            {canFilter && !filters.responsibles.length ? (
              <p className="mt-2.5 px-1 text-xs text-slate-500 dark:text-slate-400">
                No responsible has KPI results in your scope yet.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {!loading && !error && filteredRows.length ? (
        <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <StatTile label="Tracked KPIs" value={stats.total} />
          <StatTile label="On target" value={stats.onTarget} tone="green" />
          <StatTile label="Off target" value={stats.offTarget} tone="red" />
          <StatTile label="No reading" value={stats.noReading} tone="muted" />
        </div>
      ) : null}

      {loading ? (
        <EmptyState>Loading KPI charts...</EmptyState>
      ) : error ? (
        <EmptyState>{error}</EmptyState>
      ) : !rows.length ? (
        <EmptyState>
          {selected === "me" ? "No KPI history found for this responsible." : "No KPI history found for this selection."}
        </EmptyState>
      ) : !filteredRows.length ? (
        <EmptyState>
          {`No ${frequency.toLowerCase()} KPI history found for ${
            selected === "me" ? "this responsible" : "this selection"
          }. `}
          <button
            type="button"
            onClick={() => changeFrequency("")}
            className="font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 dark:text-blue-400"
          >
            Show all frequencies
          </button>
        </EmptyState>
      ) : (
        <>
          {showOwners ? (
            <div className="flex flex-col gap-8">
              {groupByResponsible(visibleRows).map((group) => (
                <div key={group.responsibleId}>
                  <div className="mb-3 flex items-baseline gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{group.name}</h3>
                    {group.unit ? <span className="text-sm text-slate-500 dark:text-slate-400">{group.unit}</span> : null}
                  </div>
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {group.rows.map((row) => (
                      <KpiChartCard key={`${row.responsible_id}-${row.kpi_id}`} row={row} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {visibleRows.map((row) => (
                <KpiChartCard key={`${row.responsible_id}-${row.kpi_id}`} row={row} />
              ))}
            </div>
          )}

          {remaining > 0 ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:shadow-none dark:hover:bg-slate-700"
              >
                Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} left
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

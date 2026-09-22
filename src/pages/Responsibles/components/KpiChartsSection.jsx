import { useEffect, useState } from "react";
import { Chart } from "react-chartjs-2";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import apiClient from "../../../api/client";
import { EmptyState } from "./ui.jsx";

ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip
);

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

function getChartValueBandColor(value, lowLimit, highLimit, direction) {
  const numericValue = normalizeChartLimitValue(value);
  const low = normalizeChartLimitValue(lowLimit);
  const high = normalizeChartLimitValue(highLimit);
  const resolvedDirection = normalizeChartDirection(direction);

  if (numericValue === null) return "rgba(148, 163, 184, 0.85)";

  const lowerBound = low !== null && high !== null ? Math.min(low, high) : low;
  const upperBound = low !== null && high !== null ? Math.max(low, high) : high;
  const isBelowLower = lowerBound !== null && numericValue < lowerBound;
  const isAboveUpper = upperBound !== null && numericValue > upperBound;
  const isBad = resolvedDirection === "down" ? isAboveUpper : isBelowLower;

  return isBad ? "rgba(239, 68, 68, 0.88)" : "rgba(74, 222, 128, 0.88)";
}

function getChartValueBorderColor(value, lowLimit, highLimit, direction) {
  const color = getChartValueBandColor(value, lowLimit, highLimit, direction);
  return color.includes("239, 68, 68") ? "rgba(220, 38, 38, 1)" : "rgba(22, 163, 74, 1)";
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

    if (lowerBound !== null && upperBound !== null) {
      drawBand(yScale.max, upperBound, "rgba(254, 226, 226, 0.55)");
      drawBand(upperBound, lowerBound, "rgba(220, 252, 231, 0.55)");
      drawBand(lowerBound, yScale.min, "rgba(254, 226, 226, 0.55)");
    } else if (upperBound !== null) {
      drawBand(yScale.max, upperBound, "rgba(254, 226, 226, 0.55)");
      drawBand(upperBound, yScale.min, "rgba(220, 252, 231, 0.55)");
    } else if (lowerBound !== null) {
      drawBand(yScale.max, lowerBound, "rgba(220, 252, 231, 0.55)");
      drawBand(lowerBound, yScale.min, "rgba(254, 226, 226, 0.55)");
    }

    chart.ctx.restore();
  },
};

function KpiChartCard({ row }) {
  const sourceLabels = Array.isArray(row.labels) ? row.labels : [];
  const periodLabels = sourceLabels.map((_, index) => `Period ${index + 1}`);
  const values = Array.isArray(row.values) ? row.values : [];

  const targetSeries = sourceLabels.map(() => row.targetValue ?? null);
  const highLimitSeries = sourceLabels.map(() => row.highLimitValue ?? null);
  const lowLimitSeries = sourceLabels.map(() => row.lowLimitValue ?? null);

  const barColors = values.map((value) =>
    getChartValueBandColor(value, row.lowLimitValue, row.highLimitValue, row.targetDirection)
  );
  const barBorderColors = values.map((value) =>
    getChartValueBorderColor(value, row.lowLimitValue, row.highLimitValue, row.targetDirection)
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
        borderColor: barBorderColors,
        backgroundColor: barColors,
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 26,
      },
      {
        type: "line",
        label: "Target",
        data: targetSeries,
        borderColor: "rgba(239, 68, 68, 0.95)",
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
        borderColor: "rgba(245, 158, 11, 0.95)",
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
        borderColor: "rgba(59, 130, 246, 0.95)",
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
      legend: { display: false },
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
        title: { display: true, text: "Period", color: "#0f172a", font: { size: 13, weight: "700" } },
        grid: { display: false },
        ticks: { color: "#64748b" },
      },
      y: {
        beginAtZero: false,
        min: axisMin,
        max: axisMax,
        title: { display: true, text: "Value", color: "#0f172a", font: { size: 13, weight: "700" } },
        ticks: { color: "#64748b" },
        grid: { color: "rgba(148,163,184,0.15)" },
      },
    },
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">{row.indicator_title || "Untitled KPI"}</h3>
      <p className="mt-0.5 text-xs text-slate-400">
        {row.indicator_sub_title || "Monthly KPI history"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-600">
          Target: {row.targetValue ?? "-"}
        </span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-600">
          High Limit: {row.highLimitValue ?? "-"}
        </span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-600">
          Low Limit: {row.lowLimitValue ?? "-"}
        </span>
      </div>
      <div className="mt-4 h-64">
        <Chart type="bar" data={data} options={options} plugins={[kpiThresholdBandsPlugin]} />
      </div>
    </div>
  );
}

export default function KpiChartsSection({ responsibleId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    apiClient
      .get(`/api/responsibles/${responsibleId}/kpi-monthly-series`)
      .then((res) => {
        if (cancelled) return;
        setRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [responsibleId]);

  return (
    <section>
      <div className="mb-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow-sm">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">My KPI Analytics</h2>
        <p className="mt-2 text-sm text-slate-500">
          Visual trends of KPI values by month for this responsible.
        </p>
      </div>

      {loading ? (
        <EmptyState>Loading KPI charts...</EmptyState>
      ) : failed ? (
        <EmptyState>Failed to load KPI charts.</EmptyState>
      ) : !rows.length ? (
        <EmptyState>No KPI history found for this responsible.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {rows.map((row) => (
            <KpiChartCard key={row.kpi_id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

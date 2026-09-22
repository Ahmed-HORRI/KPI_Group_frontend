import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { getKpiBounds, isOutOfTarget, toNumber } from "../kpiEntryFormUtils";

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip);

// Mini trend chart for one KPI card. Same series the original page drew
// (12 past periods + 3 future ones, built server-side by
// buildKpiChartHistorySeries) and the same threshold lines
// (upper limit amber, target green, lower limit red, all dashed).
//
// The bar for the current period follows what the user types, which is what
// the original did through updateCurrentMonthBarFromInput(). The original
// also re-fetched /api/kpi-chart-data for every card every 30 seconds on an
// interval it never cleared; that endpoint reads the same kpi_result rows
// through the same series builder as the form endpoint, so the poll is
// dropped here rather than reproduced.
export default function KpiEntryFormChart({ kpi, typedValue }) {
  const { labels, values, current_period_label: currentPeriodLabel } = kpi.chart || {};

  const data = useMemo(() => {
    const chartLabels = labels || [];
    const baseValues = values || [];
    const currentIndex = chartLabels.indexOf(currentPeriodLabel);
    const liveValues = baseValues.slice();
    const typed = toNumber(typedValue);
    if (currentIndex >= 0) {
      liveValues[currentIndex] = typed;
    }

    const barColors = liveValues.map((value) => {
      if (value === null || value === undefined) return "#cbd5e1";
      return isOutOfTarget(value, kpi.low_limit, kpi.high_limit, kpi.good_direction)
        ? "#e34b24"
        : "#15803d";
    });

    const datasets = [
      {
        type: "bar",
        label: kpi.title,
        data: liveValues,
        backgroundColor: barColors,
        borderRadius: 4,
        barThickness: 18,
      },
    ];

    const thresholds = [
      { key: "high_limit", label: "Upper Limit", color: "#f59e0b" },
      { key: "target", label: "Target", color: "#22c55e" },
      { key: "low_limit", label: "Lower Limit", color: "#ef4444" },
    ];
    thresholds.forEach(({ key, label, color }) => {
      const value = toNumber(kpi[key]);
      if (value === null) return;
      datasets.push({
        type: "line",
        label,
        data: liveValues.map(() => value),
        borderColor: color,
        borderWidth: 1.5,
        borderDash: [8, 5],
        pointRadius: 0,
        fill: false,
      });
    });

    return { labels: chartLabels, datasets };
  }, [labels, values, currentPeriodLabel, typedValue, kpi]);

  const { lowerBound, upperBound } = getKpiBounds(kpi.low_limit, kpi.high_limit);

  return (
    <div className="h-52">
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `${context.dataset.label}: ${context.parsed.y ?? "—"} ${kpi.unit || ""}`.trim(),
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 60 } },
            y: {
              grid: { color: "rgba(148,163,184,0.15)" },
              ticks: { font: { size: 10 } },
              suggestedMin: lowerBound !== null ? lowerBound : undefined,
              suggestedMax: upperBound !== null ? upperBound : undefined,
            },
          },
        }}
      />
    </div>
  );
}

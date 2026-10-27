import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import apiClient from "../../api/client";
import BoardTitle from "../../components/BoardTitle.jsx";
import { FactoryIcon } from "../../components/icons.jsx";
import { useChartColors } from "../../theme/chartColors.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Simplified, presentational-only status check (color of the trend points/badge):
// good when the value sits within [low_limit, high_limit] where each side is defined.
function isValueGood(value, lowLimit, highLimit) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (highLimit !== null && value > highLimit) return false;
  if (lowLimit !== null && value < lowLimit) return false;
  return true;
}

function KpiCard({ kpi }) {
  const colors = useChartColors();
  const weeklyData = kpi.weeklyData || { weeks: [], values: [] };
  const weeks = (weeklyData.weeks || []).slice(0, 12);
  const values = (weeklyData.values || []).slice(0, 12);
  const target = kpi.target !== null && kpi.target !== "None" ? Number(kpi.target) : null;
  const highLimit = kpi.high_limit !== null && kpi.high_limit !== "None" ? Number(kpi.high_limit) : null;
  const lowLimit = kpi.low_limit !== null && kpi.low_limit !== "None" ? Number(kpi.low_limit) : null;
  const currentValue = values.length ? values[values.length - 1] : null;
  const good = isValueGood(currentValue, lowLimit, highLimit);

  if (!values.length) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400 dark:text-slate-500">
        No data for {kpi.subtitle || kpi.title}
      </div>
    );
  }

  const pointColors = values.map((v) => {
    const g = isValueGood(v, lowLimit, highLimit);
    return g === false ? colors.critical : colors.good;
  });

  const datasets = [
    {
      label: (kpi.subtitle || kpi.title || "").slice(0, 40),
      data: values,
      borderColor: colors.value,
      borderWidth: 2,
      pointBackgroundColor: pointColors,
      pointBorderColor: colors.surface,
      pointBorderWidth: 2,
      pointRadius: 5,
      tension: 0,
    },
  ];
  if (highLimit !== null) {
    datasets.push({
      label: `High Limit (${highLimit})`,
      data: values.map(() => highLimit),
      borderColor: colors.limit,
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
    });
  }
  if (target !== null) {
    datasets.push({
      label: `Target (${target})`,
      data: values.map(() => target),
      borderColor: colors.target,
      borderWidth: 2,
      pointRadius: 0,
    });
  }
  if (lowLimit !== null) {
    datasets.push({
      label: `Low Limit (${lowLimit})`,
      data: values.map(() => lowLimit),
      borderColor: colors.limit,
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-800 dark:text-white">{kpi.subtitle || kpi.title}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">{kpi.title}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            good === false ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : good === true ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }`}
        >
          {currentValue} {kpi.unit || ""}
        </span>
      </div>
      <div className="mb-2 text-xs text-slate-400 dark:text-slate-500">
        Responsible: {kpi.responsible || "N/A"} · Updated {kpi.lastUpdated ? new Date(kpi.lastUpdated).toLocaleDateString() : "N/A"}
      </div>
      <div className="h-40">
        <Line
          data={{ labels: weeks, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false }, ticks: { color: colors.text } }, y: { grid: { color: colors.grid }, ticks: { color: colors.text } } },
          }}
        />
      </div>
      {kpi.correctiveAction && (
        <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Corrective action: {kpi.correctiveAction.status || "Open"}
        </div>
      )}
    </div>
  );
}

export default function CeoReportPlantPage() {
  const { plantId } = useParams();
  const [searchParams] = useSearchParams();
  const week = searchParams.get("week") || "";
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiClient
      .get(`/api/ceo-report/plants/${plantId}`, { params: week ? { week } : {} })
      .then((res) => {
        if (!cancelled) setReport(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || "Failed to generate CEO report preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plantId, week]);

  if (loading) {
    return <div className="p-10 text-center text-slate-400 dark:text-slate-500">Loading report...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500 dark:text-red-400">{error}</div>;
  }

  if (!report) return null;

  const { plant, week: reportWeek, kpisByDepartment, stats, deliveryRecipient } = report;
  const departments = Object.keys(kpisByDepartment).sort();

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <BoardTitle
          icon={FactoryIcon}
          eyebrow="Plant KPI report"
          title="CEO KPI Group DASHBOARD"
          subtitle={
            <>
              <strong className="text-slate-700 dark:text-slate-200">{plant.plant_name}</strong> · Week{" "}
              <strong className="text-slate-700 dark:text-slate-200">{reportWeek.replace("2026-Week", "W")}</strong> · Manager{" "}
              <strong className="text-slate-700 dark:text-slate-200">{plant.manager || "N/A"}</strong>
              {deliveryRecipient && (
                <>
                  {" "}
                  · Recipient <strong className="text-slate-700 dark:text-slate-200">{deliveryRecipient}</strong>
                </>
              )}
            </>
          }
        />
        <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-5">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{stats.totalDepartments}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Departments</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-slate-700 dark:text-slate-200">{stats.totalKPIs}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total KPIs</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-orange-700 dark:text-orange-300">{reportWeek.replace("2026-Week", "W")}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Current Week</div>
          </div>
        </div>
      </div>

      {departments.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 text-center text-slate-400 dark:text-slate-500">No KPI data available</div>
      )}

      {departments.map((department) => {
        const kpis = kpisByDepartment[department];
        if (!kpis.length) return null;
        return (
          <div key={department} className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            {/* One AVO blue rule for every department: the name identifies it. */}
            <div className="mb-4 flex items-center gap-3 border-b-4 border-blue-600 pb-3">
              <span className="text-lg font-bold uppercase text-slate-800 dark:text-white">{department}</span>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs text-slate-500 dark:text-slate-400">{kpis.length} KPIs</span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.id + "-" + (kpi.allocationId || "")} kpi={kpi} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const DEPARTMENT_COLORS = {
  Sales: "#667eea",
  Production: "#4facfe",
  Quality: "#43e97b",
  VOH: "#909d6f",
  Engineering: "#36a07b",
  "Human resources": "#78d69a",
  Stocks: "#6a772a",
  "AR/AP": "#96ce25",
  Cash: "#54591b",
};

function getDepartmentColor(name = "") {
  const match = Object.keys(DEPARTMENT_COLORS).find((key) => name.includes(key));
  return match ? DEPARTMENT_COLORS[match] : "#6c757d";
}

// Simplified, presentational-only status check (color of the trend points/badge):
// good when the value sits within [low_limit, high_limit] where each side is defined.
function isValueGood(value, lowLimit, highLimit) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (highLimit !== null && value > highLimit) return false;
  if (lowLimit !== null && value < lowLimit) return false;
  return true;
}

function KpiCard({ kpi }) {
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
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        No data for {kpi.subtitle || kpi.title}
      </div>
    );
  }

  const pointColors = values.map((v) => {
    const g = isValueGood(v, lowLimit, highLimit);
    return g === false ? "#dc2626" : "#22c55e";
  });

  const datasets = [
    {
      label: (kpi.subtitle || kpi.title || "").slice(0, 40),
      data: values,
      borderColor: "#94a3b8",
      borderWidth: 2,
      pointBackgroundColor: pointColors,
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
      pointRadius: 5,
      tension: 0,
    },
  ];
  if (highLimit !== null) {
    datasets.push({
      label: `High Limit (${highLimit})`,
      data: values.map(() => highLimit),
      borderColor: "#f97316",
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
    });
  }
  if (target !== null) {
    datasets.push({
      label: `Target (${target})`,
      data: values.map(() => target),
      borderColor: "#16a34a",
      borderWidth: 2,
      pointRadius: 0,
    });
  }
  if (lowLimit !== null) {
    datasets.push({
      label: `Low Limit (${lowLimit})`,
      data: values.map(() => lowLimit),
      borderColor: "#dc2626",
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-800">{kpi.subtitle || kpi.title}</div>
          <div className="text-xs text-slate-400">{kpi.title}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            good === false ? "bg-red-50 text-red-600" : good === true ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"
          }`}
        >
          {currentValue} {kpi.unit || ""}
        </span>
      </div>
      <div className="mb-2 text-xs text-slate-400">
        Responsible: {kpi.responsible || "N/A"} · Updated {kpi.lastUpdated ? new Date(kpi.lastUpdated).toLocaleDateString() : "N/A"}
      </div>
      <div className="h-40">
        <Line
          data={{ labels: weeks, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(148,163,184,0.15)" } } },
          }}
        />
      </div>
      {kpi.correctiveAction && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
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
    return <div className="p-10 text-center text-slate-400">Loading report...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500">{error}</div>;
  }

  if (!report) return null;

  const { plant, week: reportWeek, kpisByDepartment, stats, deliveryRecipient } = report;
  const departments = Object.keys(kpisByDepartment).sort();

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-800">CEO KPI Group DASHBOARD</h1>
        <div className="mt-2 text-sm text-slate-500">
          <strong className="text-slate-700">{plant.plant_name}</strong> · Week{" "}
          <strong className="text-slate-700">{reportWeek.replace("2026-Week", "W")}</strong> · Manager{" "}
          <strong className="text-slate-700">{plant.manager || "N/A"}</strong>
          {deliveryRecipient && (
            <>
              {" "}
              · Recipient <strong className="text-slate-700">{deliveryRecipient}</strong>
            </>
          )}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl bg-slate-50 p-5">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-blue-600">{stats.totalDepartments}</div>
            <div className="text-xs text-slate-500">Departments</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-green-600">{stats.totalKPIs}</div>
            <div className="text-xs text-slate-500">Total KPIs</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-violet-600">{reportWeek.replace("2026-Week", "W")}</div>
            <div className="text-xs text-slate-500">Current Week</div>
          </div>
        </div>
      </div>

      {departments.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-slate-400">No KPI data available</div>
      )}

      {departments.map((department) => {
        const kpis = kpisByDepartment[department];
        if (!kpis.length) return null;
        const color = getDepartmentColor(department);
        return (
          <div key={department} className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b-4 pb-3" style={{ borderColor: color }}>
              <span className="text-lg font-bold uppercase text-slate-800">{department}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{kpis.length} KPIs</span>
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

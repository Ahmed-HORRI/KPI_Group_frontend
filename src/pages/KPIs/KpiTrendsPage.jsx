import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { ChartIcon } from "../../components/icons.jsx";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Data source note: the original GET /kpi-trends queried
// public."Responsible"/public."Plant"/public."Department"/public."Kpi"/
// public.kpi_values_hist26 -- confirmed via information_schema that none of
// these legacy tables exist in the current database, so that page has
// thrown on every request since before this migration (not a regression).
// This page instead builds the same "trend charts per KPI for a
// responsible" experience from working, already-migrated endpoints:
// GET /api/responsibles/:id/dashboard for the responsible's KPI list (every
// KPI they've submitted a value for, across all months), then
// GET /api/kpi-chart-data per KPI for its actual history/target/limits.

function isValueGood(value, lowLimit, highLimit) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (highLimit !== null && value > highLimit) return false;
  if (lowLimit !== null && value < lowLimit) return false;
  return true;
}

function TrendChart({ kpi, chart }) {
  const colors = useChartColors();
  const highLimit = chart.highLimit !== null && chart.highLimit !== undefined ? Number(chart.highLimit) : null;
  const lowLimit = chart.lowLimit !== null && chart.lowLimit !== undefined ? Number(chart.lowLimit) : null;
  const target = chart.target !== null && chart.target !== undefined ? Number(chart.target) : null;
  const values = chart.values || [];

  const pointColors = values.map((v) => {
    if (v === null || v === undefined) return colors.missing;
    const g = isValueGood(v, lowLimit, highLimit);
    return g === false ? colors.critical : colors.good;
  });

  const datasets = [
    {
      label: kpi.indicator_sub_title || kpi.subject,
      data: values,
      borderColor: colors.value,
      borderWidth: 2,
      pointBackgroundColor: pointColors,
      pointBorderColor: colors.surface,
      pointBorderWidth: 2,
      pointRadius: 4,
      spanGaps: true,
      tension: 0,
    },
  ];
  if (highLimit !== null) {
    datasets.push({ label: `High Limit (${highLimit})`, data: values.map(() => highLimit), borderColor: colors.limit, borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0 });
  }
  if (target !== null) {
    datasets.push({ label: `Target (${target})`, data: values.map(() => target), borderColor: colors.target, borderWidth: 2, pointRadius: 0 });
  }
  if (lowLimit !== null) {
    datasets.push({ label: `Low Limit (${lowLimit})`, data: values.map(() => lowLimit), borderColor: colors.limit, borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0 });
  }

  const good = isValueGood(chart.currentValue, lowLimit, highLimit);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-800 dark:text-white">{kpi.indicator_sub_title || kpi.subject}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">{kpi.subject}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            good === false ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : good === true ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }`}
        >
          {chart.currentValue ?? "—"} {kpi.unit || ""}
        </span>
      </div>
      <div className="mt-3 h-48">
        <Line
          data={{ labels: chart.labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: colors.text } }, y: { grid: { color: colors.grid }, ticks: { color: colors.text } } },
          }}
        />
      </div>
    </div>
  );
}

export default function KpiTrendsPage() {
  const [searchParams] = useSearchParams();
  const responsibleId = searchParams.get("responsible_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kpis, setKpis] = useState([]);
  const [charts, setCharts] = useState({});

  useEffect(() => {
    if (!responsibleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    apiClient
      .get(`/api/responsibles/${responsibleId}/dashboard`)
      .then(async (res) => {
        if (cancelled) return;
        const months = res.data.months || [];
        const byAllocation = new Map();
        months.forEach((month) => {
          (month.kpis || []).forEach((kpi) => {
            const key = kpi.kpi_target_allocation_id || kpi.kpi_id;
            if (!byAllocation.has(key)) byAllocation.set(key, kpi);
          });
        });
        const uniqueKpis = Array.from(byAllocation.values());
        setKpis(uniqueKpis);

        const chartResults = await Promise.all(
          uniqueKpis.map((kpi) =>
            apiClient
              .get("/api/kpi-chart-data", {
                params: {
                  kpi_values_id: kpi.kpi_target_allocation_id,
                  kpi_id: kpi.kpi_id,
                  week: kpi.week || kpi.period_label,
                  frequency: kpi.frequency || "Weekly",
                },
              })
              .then((chartRes) => [kpi.kpi_target_allocation_id || kpi.kpi_id, chartRes.data])
              .catch(() => [kpi.kpi_target_allocation_id || kpi.kpi_id, null])
          )
        );
        if (cancelled) return;
        setCharts(Object.fromEntries(chartResults));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || "Failed to load KPI trends.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [responsibleId]);

  const kpisWithCharts = useMemo(
    () => kpis.filter((kpi) => charts[kpi.kpi_target_allocation_id || kpi.kpi_id]),
    [kpis, charts]
  );

  if (!responsibleId) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-6 text-center text-sm font-semibold text-red-600 dark:text-red-400">
          Missing responsible_id
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400 dark:text-slate-500">Loading KPI trends...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500 dark:text-red-400">{error}</div>;
  }

  if (kpisWithCharts.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center p-6">
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-10 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">No KPI Trends Available</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Start filling KPI forms to see trend charts.</p>
          <Link
            to={`/form?responsible_id=${encodeURIComponent(responsibleId)}`}
            className="mt-6 inline-block rounded-xl btn-brand px-6 py-3 text-sm font-bold shadow-lg"
          >
            Start Filling KPIs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <BoardTitle className="mb-6" icon={ChartIcon} eyebrow="KPI analytics" title="KPI Trends" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {kpisWithCharts.map((kpi) => (
          <TrendChart
            key={kpi.kpi_target_allocation_id || kpi.kpi_id}
            kpi={kpi}
            chart={charts[kpi.kpi_target_allocation_id || kpi.kpi_id]}
          />
        ))}
      </div>
    </div>
  );
}

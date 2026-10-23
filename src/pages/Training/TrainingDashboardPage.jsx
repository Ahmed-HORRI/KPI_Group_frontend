import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import apiClient from "../../api/client";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const PAGE_SIZE = 15;

const STATUS_LABELS = {
  training_sent: "Training Sent",
  training_done: "Training Done",
  test_sent: "Test Sent",
  test_overdue: "Test Overdue",
  completed_pass: "Passed",
  completed_fail: "Failed",
  escalated: "Escalated",
};

const STATUS_BADGE_CLASSES = {
  training_sent: "bg-blue-50 text-blue-700",
  training_done: "bg-emerald-50 text-emerald-700",
  test_sent: "bg-violet-50 text-violet-700",
  test_overdue: "bg-amber-50 text-amber-700",
  completed_pass: "bg-green-50 text-green-700",
  completed_fail: "bg-red-50 text-red-700",
  escalated: "bg-red-100 text-red-800",
};

const STATUS_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#34d399", "#ef4444", "#f87171"];

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent}`}>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-800">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function ScoreCell({ row }) {
  if (row.score === null || row.score === undefined) {
    const targetScore = row.pass_score || 80;
    return (
      <div className="w-32">
        <div className="text-xs font-extrabold text-blue-600">{Number(targetScore)}%</div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-green-400" style={{ width: `${targetScore}%` }} />
        </div>
      </div>
    );
  }
  const pct = Math.min(100, row.score);
  const barClass = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="w-32">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-extrabold ${row.passed ? "text-green-600" : "text-red-600"}`}>{pct.toFixed(1)}%</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${row.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {row.passed ? "PASS" : "FAIL"}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DueDateCell({ row }) {
  if (!row.test_due_date) return <span className="text-slate-300">—</span>;
  const diff = Math.round((new Date(row.test_due_date) - new Date()) / (1000 * 3600 * 24));
  if (diff < 0) {
    return <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-600">Overdue {Math.abs(diff)}d</span>;
  }
  if (diff <= 3) {
    return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Due in {diff}d</span>;
  }
  return <span className="text-xs text-slate-500">{formatDate(row.test_due_date)}</span>;
}

export default function TrainingDashboardPage() {
  const [searchParams] = useSearchParams();
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Deep-linked from the Responsible dashboard's "Training Session Dashboard"
  // nav item (?search=<name>), which pre-fills this same search box instead of
  // needing a person-scoped variant of this page.
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [passFilter, setPassFilter] = useState("");
  const [escFilter, setEscFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/api/kpi-training/results")
      .then((res) => {
        if (cancelled) return;
        setAllRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || "Failed to load training results.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter((row) => {
      const text = [row.people_name, row.kpi_name, row.training_name, row.role_name].join(" ").toLowerCase();
      if (q && !text.includes(q)) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (passFilter === "pass" && row.passed !== true) return false;
      if (passFilter === "fail" && row.passed !== false) return false;
      if (passFilter === "pending" && row.score !== null) return false;
      if (escFilter !== "" && String(row.escalation_level) !== escFilter) return false;
      return true;
    });
  }, [allRows, search, statusFilter, passFilter, escFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, passFilter, escFilter]);

  const stats = useMemo(() => {
    const completed = filteredRows.filter((row) => row.score !== null);
    const passed = completed.filter((row) => row.passed);
    const avgScore = completed.length
      ? (completed.reduce((sum, row) => sum + row.score, 0) / completed.length).toFixed(1)
      : "—";
    const passRate = completed.length ? `${Math.round((passed.length / completed.length) * 100)}%` : "—";
    const overdue = filteredRows.filter((row) => ["test_overdue", "escalated"].includes(row.status)).length;
    const pending = filteredRows.filter((row) => ["training_sent", "training_done", "test_sent"].includes(row.status)).length;
    return {
      total: filteredRows.length,
      passRate,
      passRateSub: `${passed.length} of ${completed.length} tested`,
      avgScore: avgScore !== "—" ? `${avgScore}%` : "—",
      overdue,
      pending,
    };
  }, [filteredRows]);

  const chartData = useMemo(() => {
    const statusCounts = {};
    const scoreBuckets = { "0-49": 0, "50-69": 0, "70-79": 0, "80-89": 0, "90-100": 0 };
    const byMonth = {};

    allRows.forEach((row) => {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      if (row.score !== null) {
        if (row.score < 50) scoreBuckets["0-49"] += 1;
        else if (row.score < 70) scoreBuckets["50-69"] += 1;
        else if (row.score < 80) scoreBuckets["70-79"] += 1;
        else if (row.score < 90) scoreBuckets["80-89"] += 1;
        else scoreBuckets["90-100"] += 1;
      }
      const completedDate = row.training_completed_at || row.test_completed_at;
      if (completedDate) {
        const monthLabel = new Date(completedDate).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        byMonth[monthLabel] = (byMonth[monthLabel] || 0) + 1;
      }
    });

    return { statusCounts, scoreBuckets, byMonth };
  }, [allRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = filteredRows.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, filteredRows.length);

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading training dashboard...</div>;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900">KPI Training Tracking Dashboard</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          className="min-w-[260px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-400"
          placeholder="Search responsible, KPI, training…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
          value={passFilter}
          onChange={(e) => setPassFilter(e.target.value)}
        >
          <option value="">All Results</option>
          <option value="pass">Passed</option>
          <option value="fail">Failed</option>
          <option value="pending">Not Tested</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
          value={escFilter}
          onChange={(e) => setEscFilter(e.target.value)}
        >
          <option value="">All Escalation Levels</option>
          <option value="0">Level 0 – None</option>
          <option value="1">Level 1 – Warning</option>
          <option value="2">Level 2 – Critical</option>
        </select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Assigned" value={stats.total} sub="training records" accent="border-blue-100 bg-blue-50/40" />
        <StatCard label="Pass Rate" value={stats.passRate} sub={stats.passRateSub} accent="border-green-100 bg-green-50/40" />
        <StatCard label="Avg Score" value={stats.avgScore} sub="on completed tests" accent="border-amber-100 bg-amber-50/40" />
        <StatCard label="Overdue / Escalated" value={stats.overdue} sub="need attention" accent="border-red-100 bg-red-50/40" />
        <StatCard label="Pending Training" value={stats.pending} sub="not yet completed" accent="border-violet-100 bg-violet-50/40" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-bold text-slate-700">Status Distribution</div>
          <div className="h-56">
            <Doughnut
              data={{
                labels: Object.keys(chartData.statusCounts).map((s) => STATUS_LABELS[s] || s),
                datasets: [{ data: Object.values(chartData.statusCounts), backgroundColor: STATUS_COLORS, borderWidth: 2, borderColor: "#fff" }],
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } } }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-bold text-slate-700">Score Distribution</div>
          <div className="h-56">
            <Bar
              data={{
                labels: Object.keys(chartData.scoreBuckets),
                datasets: [{ label: "# of Tests", data: Object.values(chartData.scoreBuckets), backgroundColor: ["#ef4444", "#f59e0b", "#fbbf24", "#10b981", "#34d399"], borderRadius: 6 }],
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-bold text-slate-700">Completion Over Time</div>
          <div className="h-56">
            <Line
              data={{
                labels: Object.keys(chartData.byMonth).length ? Object.keys(chartData.byMonth) : ["No Data"],
                datasets: [
                  {
                    label: "Completions",
                    data: Object.keys(chartData.byMonth).length ? Object.values(chartData.byMonth) : [0],
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(37,99,235,.10)",
                    borderWidth: 2.5,
                    pointRadius: 4,
                    tension: 0.35,
                    fill: true,
                  },
                ],
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-800">
            Training Records {filteredRows.length ? `(${filteredRows.length})` : ""}
          </h3>
          <div className="text-xs text-slate-400">
            Showing {filteredRows.length ? `${showingFrom}–${showingTo} of ${filteredRows.length}` : "0"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Responsible</th>
                <th className="px-4 py-3">KPI Subject</th>
                <th className="px-4 py-3">Training</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Escalation</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-slate-400">
                    🔍 No records match your filters.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => {
                const initials = (row.people_name || "")
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <tr key={row.result_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{row.people_name || "—"}</div>
                          <div className="text-xs text-slate-400">{row.role_name || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{row.kpi_name || ""}</div>
                      {row.kpi_target_allocation_id && (
                        <div className="text-xs text-slate-400">Allocation #{row.kpi_target_allocation_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{row.training_name || ""}</div>
                      {row.training_id && <div className="text-xs text-slate-400">ID #{row.training_id}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE_CLASSES[row.status] || "bg-slate-100 text-slate-600"}`}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ScoreCell row={row} /></td>
                    <td className="px-4 py-3"><DueDateCell row={row} /></td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">L{row.escalation_level}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {row.test_completed_at
                        ? formatDate(row.test_completed_at)
                        : row.training_completed_at
                          ? `Train: ${formatDate(row.training_completed_at)}`
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-5 py-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`h-8 w-8 rounded-lg text-xs font-bold ${p === page ? "bg-[#0078D7] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

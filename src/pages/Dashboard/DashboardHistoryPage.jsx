import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../api/client";

// Data source note: the original GET /dashboard-history queried
// public.kpi_values_hist26 JOIN public."Kpi" -- confirmed via
// information_schema that neither table exists in the current database, so
// that page has thrown on every request since before this migration (not a
// regression). There is no old_value/new_value pairing left to recover from
// data that no longer exists. This page instead calls the new
// GET /api/responsibles/:id/kpi-value-history, which returns every
// kpi_result row ever recorded for this responsible (newest first) as the
// closest modern equivalent -- shown as a single "Value" column rather than
// Old Value/New Value, since each row already IS one point-in-time value.

function formatTimestamp(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export default function DashboardHistoryPage() {
  const [searchParams] = useSearchParams();
  const responsibleId = searchParams.get("responsible_id");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!responsibleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    apiClient
      .get(`/api/responsibles/${responsibleId}/kpi-value-history`)
      .then((res) => {
        if (cancelled) return;
        const histRows = Array.isArray(res.data) ? res.data : [];
        setRows(histRows);
        setUnavailable(histRows.length === 0);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [responsibleId]);

  if (!responsibleId) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-600">
          Missing responsible_id
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-blue-600">KPI Value History</h1>

        {loading && <div className="p-14 text-center text-slate-400">Loading history...</div>}

        {!loading && unavailable && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            No KPI value history records available for this responsible.
          </div>
        )}

        {!loading && !unavailable && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border border-slate-200 px-3 py-2.5">Indicator</th>
                  <th className="border border-slate-200 px-3 py-2.5">Sub Title</th>
                  <th className="border border-slate-200 px-3 py-2.5">Week</th>
                  <th className="border border-slate-200 px-3 py-2.5">Value</th>
                  <th className="border border-slate-200 px-3 py-2.5">Unit</th>
                  <th className="border border-slate-200 px-3 py-2.5">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.hist_id ?? index} className={index % 2 === 1 ? "bg-slate-50" : ""}>
                    <td className="border border-slate-200 px-3 py-2.5">{row.subject}</td>
                    <td className="border border-slate-200 px-3 py-2.5">{row.indicator_sub_title || "-"}</td>
                    <td className="border border-slate-200 px-3 py-2.5">{row.week}</td>
                    <td className="border border-slate-200 px-3 py-2.5">{row.value ?? "-"}</td>
                    <td className="border border-slate-200 px-3 py-2.5">{row.unit || ""}</td>
                    <td className="border border-slate-200 px-3 py-2.5">{formatTimestamp(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../../api/client";
import {
  KFS_OPTIONS,
  UNIT_OPTIONS,
  FREQUENCY_OPTIONS,
  DIRECTION_OPTIONS,
  MIN_MAX_TYPE_OPTIONS,
  REACTIVITY_STATUS_OPTIONS,
  PRICING_TYPE_OPTIONS,
  IMPORTANCE_OPTIONS,
  REACTIVITY_NEED_OPTIONS,
  CALCULATION_ON_OPTIONS,
  CALCULATION_MODE_OPTIONS,
  DISPLAY_TREND_OPTIONS,
  REGRESSION_OPTIONS,
  TARGET_AUTO_ADJUSTMENT_OPTIONS,
  TOLERANCE_TYPE_OPTIONS,
  KPI_FORM_DEFAULTS,
} from "../../constants/kpiOptions";

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

// Real KPI rows can carry values outside the "official" option list (e.g. governance
// workflow states like "To Validate" on target_auto_adjustment). If the current value
// isn't one of the known options, keep it selectable so editing never silently
// overwrites it with the first option in the list.
function withCurrentValue(options, current) {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

export default function KpiAdminPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingTable, setLoadingTable] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(KPI_FORM_DEFAULTS);
  const [selectedKpiId, setSelectedKpiId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  };

  const loadKpis = async (searchText = "") => {
    setLoadingTable(true);
    try {
      const res = await apiClient.get("/api/kpis", { params: { search: searchText } });
      setRows(res.data || []);
    } catch {
      setRows([]);
      showToast("Failed to load KPI table.");
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => loadKpis(search), 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const updateField = (id, value) => setForm((prev) => ({ ...prev, [id]: value }));

  const openNewDrawer = () => {
    setSelectedKpiId(null);
    setForm(KPI_FORM_DEFAULTS);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (id) => {
    try {
      const res = await apiClient.get(`/api/kpis/${id}`);
      const data = res.data;
      setSelectedKpiId(data.kpi_id);
      setForm({
        ...KPI_FORM_DEFAULTS,
        ...data,
        min: data.min ?? "",
        max: data.max ?? "",
        min_type: data.min !== null && data.min !== undefined ? "Valeur a entrer" : "Null",
        max_type: data.max !== null && data.max !== undefined ? "Valeur a entrer" : "Null",
        target: data.target ?? "",
        high_limit: data.high_limit ?? "",
        low_limit: data.low_limit ?? "",
        up_tolerance: data.up_tolerance ?? "",
        low_tolerance: data.low_tolerance ?? "",
        reference_kpi_id: data.reference_kpi_id ?? "",
        nombre_periode: data.nombre_periode ?? "",
        regression: data.regression || "1 week",
      });
      setDrawerOpen(true);
    } catch {
      showToast("Unable to load KPI");
    }
  };

  const closeDrawer = () => setDrawerOpen(false);

  const buildPayload = () => ({
    kfs: form.kfs || "KPI",
    indicator_title: form.indicator_title,
    indicator_sub_title: form.indicator_sub_title,
    subject: form.subject,
    unit: form.unit,
    frequency: form.frequency,
    target_direction: form.target_direction,
    min_type: form.min_type,
    max_type: form.max_type,
    min: form.min_type === "Valeur a entrer" ? form.min : null,
    max: form.max_type === "Valeur a entrer" ? form.max : null,
    reactivity_status: form.reactivity_status || null,
    pricing_type: form.pricing_type || null,
    importance: form.importance || null,
    reactivity_need: form.reactivity_need || null,
    calculation_on: form.calculation_on,
    nombre_periode: form.calculation_on === "Average" ? form.nombre_periode : null,
    calculation_mode: form.calculation_mode,
    reference_kpi_id: form.calculation_mode === "Ratio" ? form.reference_kpi_id || null : null,
    display_trend: form.display_trend,
    regression: form.display_trend === "Yes" ? form.regression : null,
    target_auto_adjustment: form.target_auto_adjustment,
    definition: form.definition,
    tolerance_type: form.tolerance_type,
    high_limit: form.tolerance_type === "Absolute" ? form.high_limit || null : null,
    low_limit: form.tolerance_type === "Absolute" ? form.low_limit || null : null,
    up_tolerance: form.tolerance_type === "Relative" ? form.up_tolerance || null : null,
    low_tolerance: form.tolerance_type === "Relative" ? form.low_tolerance || null : null,
    target: form.target || null,
    status: form.status || "Active",
  });

  const saveKpi = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = selectedKpiId
        ? await apiClient.put(`/api/kpis/${selectedKpiId}`, payload)
        : await apiClient.post("/api/kpis", payload);
      setSelectedKpiId(res.data.kpi_id);
      await loadKpis(search);
      showToast("KPI saved successfully");
      closeDrawer();
    } catch (err) {
      showToast(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteKpi = async (id) => {
    if (!window.confirm(`Delete KPI #${id} ?`)) return;
    try {
      await apiClient.delete(`/api/kpis/${id}`);
      if (String(selectedKpiId) === String(id)) closeDrawer();
      await loadKpis(search);
      showToast("KPI deleted");
    } catch {
      showToast("Delete failed");
    }
  };

  const rowCount = rows.length;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="relative mb-6 flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 p-8 shadow-xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">KPI Management Dashboard</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-500">
            Create, update and manage all KPI definitions used across the organization.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold shadow-sm transition hover:-translate-y-0.5"
            onClick={() => loadKpis(search)}
          >
            Refresh
          </button>
          <button
            className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5"
            onClick={openNewDrawer}
          >
            + Add KPI
          </button>
        </div>
      </div>

      <div className="mb-5">
        <input
          className={inputClass}
          placeholder="Search by title, subtitle, subject, frequency..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h3 className="text-lg font-bold text-slate-800">KPI Master List</h3>
          <span className="text-sm text-slate-500">
            Total rows: <strong>{rowCount}</strong>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Indicator</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingTable && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-slate-400">
                    Loading KPIs...
                  </td>
                </tr>
              )}
              {!loadingTable && rowCount === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-slate-400">
                    No KPI found.
                  </td>
                </tr>
              )}
              {!loadingTable &&
                rows.map((row) => (
                  <tr key={row.kpi_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        #{row.kpi_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{row.indicator_title || "Untitled KPI"}</div>
                      <div className="text-xs text-slate-400">{row.indicator_sub_title || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.subject || ""}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        {row.unit || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.target ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.status || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                          onClick={() => openEditDrawer(row.kpi_id)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                          onClick={() => deleteKpi(row.kpi_id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={closeDrawer}>
          <div
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {selectedKpiId ? `Edit KPI #${selectedKpiId}` : "Create KPI"}
              </h2>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold" onClick={closeDrawer}>
                Close
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type">
                  <select className={inputClass} value={form.kfs} onChange={(e) => updateField("kfs", e.target.value)}>
                    {KFS_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <input
                    className={inputClass}
                    value={form.indicator_title}
                    onChange={(e) => updateField("indicator_title", e.target.value)}
                  />
                </Field>
              </div>

              <Field label="KPI Name">
                <input
                  className={inputClass}
                  placeholder="Type or adjust the KPI name"
                  value={form.indicator_sub_title}
                  onChange={(e) => updateField("indicator_sub_title", e.target.value)}
                />
              </Field>

              <Field label="Subject">
                <input
                  className={inputClass}
                  placeholder="Exact subject name or full path, e.g. Company Success / Cash generation"
                  value={form.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                />
                <span className="text-xs text-slate-400">
                  Must match an existing subject name or full hierarchy path exactly (case-insensitive).
                </span>
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Unit">
                  <select className={inputClass} value={form.unit} onChange={(e) => updateField("unit", e.target.value)}>
                    {withCurrentValue(UNIT_OPTIONS, form.unit).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Frequency">
                  <select className={inputClass} value={form.frequency} onChange={(e) => updateField("frequency", e.target.value)}>
                    <option value="">Select Frequency</option>
                    {FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                    {form.frequency && !FREQUENCY_OPTIONS.some((o) => o.value === form.frequency) && (
                      <option value={form.frequency}>{form.frequency}</option>
                    )}
                  </select>
                </Field>
                <Field label="Direction">
                  <select
                    className={inputClass}
                    value={form.target_direction}
                    onChange={(e) => updateField("target_direction", e.target.value)}
                  >
                    <option value="">Select Direction</option>
                    {withCurrentValue(DIRECTION_OPTIONS, form.target_direction).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Min">
                  <select className={inputClass} value={form.min_type} onChange={(e) => updateField("min_type", e.target.value)}>
                    {MIN_MAX_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                {form.min_type === "Valeur a entrer" && (
                  <Field label="Min Value">
                    <input className={inputClass} value={form.min} onChange={(e) => updateField("min", e.target.value)} />
                  </Field>
                )}
                <Field label="Max">
                  <select className={inputClass} value={form.max_type} onChange={(e) => updateField("max_type", e.target.value)}>
                    {MIN_MAX_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                {form.max_type === "Valeur a entrer" && (
                  <Field label="Max Value">
                    <input className={inputClass} value={form.max} onChange={(e) => updateField("max", e.target.value)} />
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Reactivity Status">
                  <select
                    className={inputClass}
                    value={form.reactivity_status}
                    onChange={(e) => updateField("reactivity_status", e.target.value)}
                  >
                    <option value="">Select reactivity status</option>
                    {REACTIVITY_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Pricing Type">
                  <select
                    className={inputClass}
                    value={form.pricing_type}
                    onChange={(e) => updateField("pricing_type", e.target.value)}
                  >
                    <option value="">Select pricing type</option>
                    {PRICING_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Importance">
                  <select className={inputClass} value={form.importance} onChange={(e) => updateField("importance", e.target.value)}>
                    <option value="">Select importance</option>
                    {IMPORTANCE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Need for responsiveness">
                  <select
                    className={inputClass}
                    value={form.reactivity_need}
                    onChange={(e) => updateField("reactivity_need", e.target.value)}
                  >
                    <option value="">Select reactivity need</option>
                    {REACTIVITY_NEED_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="section-title border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                Calculation logic
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Calculation On">
                  <select
                    className={inputClass}
                    value={form.calculation_on}
                    onChange={(e) => updateField("calculation_on", e.target.value)}
                  >
                    <option value="">Select Calculation On</option>
                    {CALCULATION_ON_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                {form.calculation_on === "Average" && (
                  <Field label="Number of Periods">
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      value={form.nombre_periode}
                      onChange={(e) => updateField("nombre_periode", e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Calculation Mode">
                  <select
                    className={inputClass}
                    value={form.calculation_mode}
                    onChange={(e) => updateField("calculation_mode", e.target.value)}
                  >
                    <option value="">Select calculation mode</option>
                    {CALCULATION_MODE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                {form.calculation_mode === "Ratio" && (
                  <Field label="Reference KPI ID">
                    <input
                      className={inputClass}
                      value={form.reference_kpi_id}
                      onChange={(e) => updateField("reference_kpi_id", e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Display Trend">
                  <select
                    className={inputClass}
                    value={form.display_trend}
                    onChange={(e) => updateField("display_trend", e.target.value)}
                  >
                    <option value="">Select display trend</option>
                    {DISPLAY_TREND_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                {form.display_trend === "Yes" && (
                  <Field label="Periods of Regression">
                    <select className={inputClass} value={form.regression} onChange={(e) => updateField("regression", e.target.value)}>
                      {REGRESSION_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Target Auto Adjust">
                  <select
                    className={inputClass}
                    value={form.target_auto_adjustment}
                    onChange={(e) => updateField("target_auto_adjustment", e.target.value)}
                  >
                    {withCurrentValue(TARGET_AUTO_ADJUSTMENT_OPTIONS, form.target_auto_adjustment).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Definition">
                <textarea
                  className={`${inputClass} min-h-[90px]`}
                  placeholder="Write a clear KPI definition..."
                  value={form.definition}
                  onChange={(e) => updateField("definition", e.target.value)}
                />
              </Field>

              <div className="section-title border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                Tolerance
              </div>
              <div className="flex gap-6">
                {TOLERANCE_TYPE_OPTIONS.map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="tolerance_type_radio"
                      value={o}
                      checked={form.tolerance_type === o}
                      onChange={() => updateField("tolerance_type", o)}
                    />
                    {o}
                  </label>
                ))}
              </div>
              {form.tolerance_type === "Absolute" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="High Limit">
                    <input
                      className={inputClass}
                      type="number"
                      step="any"
                      placeholder="e.g. 544.5"
                      value={form.high_limit}
                      onChange={(e) => updateField("high_limit", e.target.value)}
                    />
                  </Field>
                  <Field label="Low Limit">
                    <input
                      className={inputClass}
                      type="number"
                      step="any"
                      placeholder="e.g. 445.5"
                      value={form.low_limit}
                      onChange={(e) => updateField("low_limit", e.target.value)}
                    />
                  </Field>
                </div>
              )}
              {form.tolerance_type === "Relative" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Up Tolerance">
                    <input
                      className={inputClass}
                      placeholder="+10%"
                      value={form.up_tolerance}
                      onChange={(e) => updateField("up_tolerance", e.target.value)}
                    />
                  </Field>
                  <Field label="Low Tolerance">
                    <input
                      className={inputClass}
                      placeholder="-10%"
                      value={form.low_tolerance}
                      onChange={(e) => updateField("low_tolerance", e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold" onClick={closeDrawer}>
                Cancel
              </button>
              <button
                className="rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                onClick={saveKpi}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save KPI"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

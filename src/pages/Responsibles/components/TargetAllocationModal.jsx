import { useMemo } from "react";
import { Field, Modal, SectionTitle, inputClass, readonlyInputClass } from "./ui.jsx";
import { getLocalDateInputValue, normalizeParameterDateValue } from "./formatting.js";
import {
  PARAMETER_KPI_TYPE_OPTIONS,
  applyRoleApplyAllPatch,
  getAutoResolvedIndividualResponsibleEntry,
  getIndividualResponsibleOptions,
  getParameterRoleLabel,
  getParameterRoleScopeOptions,
  getParameterScopeKind,
  getParameterSelectedKpiUnit,
  getParameterUnitMetaText,
  getParameterUnitState,
  getParameterVisibleUnitRows,
  getRoleApplyAllSharedSetupDateValue,
  getRoleApplyAllSharedTargetValue,
  getRoleApplyAllUnitSummary,
  getNormalizedParameterRoleId,
  isIndividualParameterScope,
  isRoleApplyAllMode,
  isRoleParameterScope,
  resolveEditModeUnitState,
  resolveParameterResponsibleEntry,
  setParameterUnitState,
  getParameterKpiById,
} from "./allocationHelpers.js";

// Port of the original page's "KPI Target Allocation" modal, including the
// multisite unit matrix (renderMultisiteUnitMatrix + syncParameterScopePresentation
// + syncIndividualParameterFields).
//
// Simplifications vs the original custom widgets (data flow unchanged):
//  * The searchable custom Role dropdown becomes a plain <select> built from
//    the same per-scope option list (populateParameterRoleScopeOptions).
//  * The spreadsheet-style drag-to-fill handle on the Target Value / Setup Date
//    columns becomes a "Fill down" button in each of those column headers,
//    which copies the first row's value into every row of the column.
//
// Fields deliberately not rendered (see the report): previous target value,
// target start/end date, target status and comments. In the original they live
// in a section that is only shown for the Individual scope, yet each of them is
// individually toggled with `!isIndividual` -- so they are unreachable in every
// scope. Their values still round-trip through the payload untouched.

function KpiNameSelect({ kpiCatalog, value, onChange }) {
  const grouped = useMemo(() => {
    const groups = new Map();
    (kpiCatalog || []).forEach((kpi) => {
      const subjectPath = String(kpi.subject || "").trim() || "Other KPIs";
      if (!groups.has(subjectPath)) groups.set(subjectPath, []);
      groups.get(subjectPath).push(kpi);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [kpiCatalog]);

  return (
    <select className={inputClass} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select KPI name</option>
      {grouped.map(([subjectPath, kpis]) => (
        <optgroup key={subjectPath} label={subjectPath.split("/").pop().trim() || subjectPath}>
          {kpis.map((kpi) => (
            <option key={kpi.kpi_id} value={String(kpi.kpi_id)}>
              {String(kpi.indicator_sub_title || "").trim() || "Untitled KPI"}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function TargetAllocationModal({
  ctx,
  kpiCatalog,
  form,
  setForm,
  unitState,
  setUnitState,
  editMode,
  editAllocations,
  lockedUnitId,
  saving,
  onSave,
  onDelete,
  onClose,
}) {
  const scopeKind = getParameterScopeKind(form);
  const isIndividual = isIndividualParameterScope(form);
  const isRoleScope = isRoleParameterScope(form);
  const isZoneScope = scopeKind === "zone";
  const isProductLineScope = scopeKind === "product_line";
  const hasKpiType = Boolean(String(form.parameter_kpi_type || "").trim());
  const shouldRequireRole = hasKpiType && !isZoneScope;

  const selectedKpi = getParameterKpiById(kpiCatalog, form.parameter_kpi_id);
  const kpiUnit = getParameterSelectedKpiUnit(kpiCatalog, form);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const roleScope = useMemo(() => getParameterRoleScopeOptions(ctx, form), [ctx, form]);
  const visibleRows = useMemo(
    () => getParameterVisibleUnitRows(ctx, form, { lockedUnitId }),
    [ctx, form, lockedUnitId]
  );

  // handleParameterKpiTypeChange(): changing the scope resets the scope-derived
  // selections that no longer apply.
  const changeKpiType = (value) => {
    update({
      parameter_kpi_type: value,
      parameter_role_target_mode:
        String(value || "").trim().toLowerCase() === "role" ? form.parameter_role_target_mode : "",
    });
  };

  const changeUnitType = (value) => {
    if (!editMode) setUnitState({});
    update({ parameter_unit_type_id: value });
  };

  const setRowState = (row, patch) => {
    const rowKind = row.row_kind || "unit";
    const scopeId = String(
      rowKind === "unit" ? row.unit_id || row.value || "" : row.value || ""
    ).trim();
    setUnitState((prev) => setParameterUnitState(prev, rowKind, scopeId, patch));
  };

  const fillColumnDown = (field) => {
    if (!visibleRows.length) return;
    const firstRow = visibleRows[0];
    const rowKind = firstRow.row_kind || "unit";
    const firstScopeId = String(
      rowKind === "unit" ? firstRow.unit_id || firstRow.value || "" : firstRow.value || ""
    ).trim();
    const sourceValue = getParameterUnitState(unitState, rowKind, firstScopeId)?.[field] ?? "";
    setUnitState((prev) => {
      let next = prev;
      visibleRows.forEach((row) => {
        const kind = row.row_kind || "unit";
        const scopeId = String(
          kind === "unit" ? row.unit_id || row.value || "" : row.value || ""
        ).trim();
        next = setParameterUnitState(next, kind, scopeId, { [field]: sourceValue });
      });
      return next;
    });
  };

  // syncIndividualParameterFields(): resolve the Individual responsible from the
  // selected unit + role when the field is still empty.
  const individualResponsible = useMemo(() => {
    if (!isIndividual) return null;
    if (String(form.parameter_set_by_people_id || "").trim()) return null;
    return getAutoResolvedIndividualResponsibleEntry(ctx, form, { lockedUnitId });
  }, [ctx, form, isIndividual, lockedUnitId]);

  const responsibleSelect = useMemo(
    () => getIndividualResponsibleOptions(ctx, form, { editMode, editAllocations }),
    [ctx, form, editMode, editAllocations]
  );

  const effectiveResponsibleId =
    String(form.parameter_set_by_people_id || "").trim() ||
    String(individualResponsible?.people_id || "");

  const roleLabel = getParameterRoleLabel(ctx.roleOptions, form.parameter_role_id);

  const responsibleHint = !roleLabel
    ? "Select the role to fetch the related responsible automatically."
    : String(form.parameter_set_by_people_id || "").trim()
      ? "Responsible selected for this allocation."
      : individualResponsible?.label
        ? `${roleLabel} matched automatically to ${individualResponsible.label}.`
        : "No related responsible was found for the selected role.";

  const scopeLabel = isZoneScope ? "Zone" : isProductLineScope ? "Product Line" : "Unit";

  const tableCopy = isZoneScope
    ? "The table below lists the zones from the zone table, then resolves the responsible from people_role_assignment for each zone while you enter the target values."
    : isRoleScope
      ? isRoleApplyAllMode(form)
        ? "The table below shows one shared row for all units linked to the selected role. The same target value and setup date will be applied to every related allocation."
        : "The table below lists each unit once for the selected role and keeps the assigned responsible linked automatically."
      : isProductLineScope
        ? "The table below lists the product lines and resolves the product line manager for each of them."
        : "The table below lists matching units, resolves the related responsible automatically, and keeps the KPI unit from the selected KPI.";

  const tableBadge = isZoneScope
    ? "Zone View"
    : isRoleScope
      ? "Role View"
      : isProductLineScope
        ? "Product Line View"
        : "Unit Type View";

  return (
    <Modal
      wide
      title={editMode ? "Edit KPI Target Allocation" : "Create KPI Target Allocation"}
      subtitle={
        editMode
          ? "Update the selected unit target allocation and keep the KPI unit synced from the chosen KPI."
          : "Create KPI target allocations by KPI, KPI type, unit type and role, then enter one target value per unit."
      }
      onClose={onClose}
      footer={
        <>
          {editMode ? (
            <button
              type="button"
              className="mr-auto rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              Delete allocation
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
            disabled={saving}
            onClick={() => onSave(effectiveResponsibleId)}
          >
            {saving ? "Saving..." : "Save Target Allocation"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Field label="KPI Name" required>
            <KpiNameSelect
              kpiCatalog={kpiCatalog}
              value={form.parameter_kpi_id}
              onChange={(value) => update({ parameter_kpi_id: value })}
            />
          </Field>
        </div>
        <div className="lg:col-span-3">
          <Field label="KPI Type" required>
            <select
              className={inputClass}
              value={form.parameter_kpi_type ?? ""}
              onChange={(e) => changeKpiType(e.target.value)}
            >
              <option value="">Select KPI Type</option>
              {PARAMETER_KPI_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!isZoneScope && !isIndividual && !isProductLineScope && !isRoleScope ? (
          <div className="lg:col-span-3">
            <Field label="Unit Type">
              <select
                className={inputClass}
                value={form.parameter_unit_type_id ?? ""}
                onChange={(e) => changeUnitType(e.target.value)}
                disabled={Boolean(lockedUnitId)}
              >
                <option value="">Select unit type</option>
                {(ctx.lookups.unitTypes || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
        {hasKpiType && !isProductLineScope ? (
          <div className="lg:col-span-3">
            <Field
              label="Role"
              required={shouldRequireRole}
              hint={isZoneScope ? "Filter zones by role or keep All roles" : "Loaded from role table"}
            >
              <select
                className={inputClass}
                value={form.parameter_role_id ?? ""}
                onChange={(e) => update({ parameter_role_id: e.target.value })}
              >
                <option value="">{roleScope.placeholder}</option>
                {roleScope.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
        {isRoleScope ? (
          <div className="lg:col-span-3">
            <Field label="Role Target Mode" required>
              <select
                className={inputClass}
                value={form.parameter_role_target_mode ?? ""}
                onChange={(e) => update({ parameter_role_target_mode: e.target.value })}
              >
                <option value="">Select mode</option>
                <option value="apply_all">Apply All</option>
                <option value="individual">Individual</option>
              </select>
            </Field>
          </div>
        ) : null}
      </div>

      <Field label="KPI Definition" hint="Read only">
        <textarea
          className={`${readonlyInputClass} min-h-[80px]`}
          readOnly
          value={selectedKpi?.definition || ""}
          placeholder={
            selectedKpi
              ? "No KPI definition available for this KPI."
              : "Select a KPI name to display the KPI definition."
          }
        />
      </Field>

      {!isIndividual ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
              {tableBadge}
            </span>
            <span className="text-xs text-slate-400">{tableCopy}</span>
          </div>
          <MultisiteMatrix
            ctx={ctx}
            form={form}
            scopeKind={scopeKind}
            scopeLabel={scopeLabel}
            kpiUnit={kpiUnit}
            visibleRows={visibleRows}
            unitState={unitState}
            setUnitState={setUnitState}
            setRowState={setRowState}
            fillColumnDown={fillColumnDown}
            editMode={editMode}
            editAllocations={editAllocations}
            lockedUnitId={lockedUnitId}
            update={update}
          />
        </div>
      ) : null}

      {isIndividual ? (
        <>
          <SectionTitle>Allocation</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Target Value" required>
              <input
                className={inputClass}
                type="number"
                step="any"
                placeholder="Enter target value"
                value={form.parameter_target_value ?? ""}
                onChange={(e) => update({ parameter_target_value: e.target.value })}
              />
            </Field>
            <Field label="Setup Date">
              <input
                className={inputClass}
                type="date"
                value={
                  normalizeParameterDateValue(form.parameter_target_setup_date) ||
                  getLocalDateInputValue()
                }
                onChange={(e) => update({ parameter_target_setup_date: e.target.value })}
              />
            </Field>
            <Field label="KPI Unit">
              <input className={readonlyInputClass} readOnly value={form.parameter_target_unit || kpiUnit || ""} />
            </Field>
            <Field label="Responsible" hint={responsibleHint}>
              <select
                className={inputClass}
                value={effectiveResponsibleId}
                onChange={(e) => update({ parameter_set_by_people_id: e.target.value })}
              >
                <option value="">{responsibleSelect.placeholder}</option>
                {responsibleSelect.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {isIndividual && !lockedUnitId ? (
            <Field label="Unit" hint="Individual allocations target a single unit">
              <select
                className={inputClass}
                value={form.parameter_plant_id ?? ""}
                onChange={(e) => update({ parameter_plant_id: e.target.value })}
              >
                <option value="">Select unit</option>
                {(ctx.lookups.plants || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}

function MultisiteMatrix({
  ctx,
  form,
  scopeKind,
  scopeLabel,
  kpiUnit,
  visibleRows,
  unitState,
  setUnitState,
  setRowState,
  fillColumnDown,
  editMode,
  editAllocations,
  lockedUnitId,
  update,
}) {
  const selectedRoleId = form.parameter_role_id;

  if (!form.parameter_kpi_id) {
    return <MatrixEmpty>Select a KPI name to load the KPI unit and available target rows.</MatrixEmpty>;
  }

  if (
    scopeKind !== "zone" &&
    scopeKind !== "product_line" &&
    scopeKind !== "role" &&
    !form.parameter_unit_type_id &&
    !lockedUnitId
  ) {
    return <MatrixEmpty>Select a unit type to display the units that should receive targets.</MatrixEmpty>;
  }

  if (scopeKind === "role" && !selectedRoleId) {
    return <MatrixEmpty>Select a role to load its people-role assignments.</MatrixEmpty>;
  }

  if (scopeKind === "role" && !String(form.parameter_role_target_mode || "").trim()) {
    return <MatrixEmpty>Select Role Target Mode to display the role view.</MatrixEmpty>;
  }

  if (!visibleRows.length) {
    return (
      <MatrixEmpty>
        {scopeKind === "zone"
          ? "No zones were found in the zone table."
          : scopeKind === "role"
            ? "No active people-role assignments with a unit_id were found for the selected role."
            : "No units were found for the selected unit type."}
      </MatrixEmpty>
    );
  }

  // Role + Apply All: one shared row applied to every related allocation.
  if (scopeKind === "role" && isRoleApplyAllMode(form)) {
    const sharedTargetValue = getRoleApplyAllSharedTargetValue(form, unitState, visibleRows);
    const sharedSetupDate = getRoleApplyAllSharedSetupDateValue(form, unitState, visibleRows);
    const unitSummary = getRoleApplyAllUnitSummary(visibleRows);
    const roleLabel = getParameterRoleLabel(ctx.roleOptions, selectedRoleId) || "Selected role";

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">{scopeLabel}</th>
              <th className="px-3 py-2.5">KPI Unit</th>
              <th className="px-3 py-2.5">Target Value</th>
              <th className="px-3 py-2.5">Setup Date</th>
              <th className="px-3 py-2.5">Role</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="px-3 py-2.5">
                <div className="font-semibold text-slate-800">{unitSummary.title}</div>
                <div className="text-xs text-slate-400">{unitSummary.detail}</div>
              </td>
              <td className="px-3 py-2.5">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  {kpiUnit || "-"}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <input
                  className={inputClass}
                  type="number"
                  step="any"
                  placeholder="Enter target value"
                  value={sharedTargetValue}
                  onChange={(e) => {
                    update({ parameter_target_value: e.target.value });
                    setUnitState((prev) =>
                      applyRoleApplyAllPatch(prev, visibleRows, { target_value: e.target.value })
                    );
                  }}
                />
              </td>
              <td className="px-3 py-2.5">
                <input
                  className={inputClass}
                  type="date"
                  value={sharedSetupDate}
                  onChange={(e) => {
                    update({ parameter_target_setup_date: e.target.value });
                    setUnitState((prev) =>
                      applyRoleApplyAllPatch(prev, visibleRows, { target_setup_date: e.target.value })
                    );
                  }}
                />
              </td>
              <td className="px-3 py-2.5">
                <div className={readonlyInputClass} title={roleLabel}>
                  {roleLabel}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const showSellCurrencyColumn = scopeKind !== "role";

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2.5">{scopeLabel}</th>
            {showSellCurrencyColumn ? <th className="px-3 py-2.5">Sell Currency</th> : null}
            <th className="px-3 py-2.5">KPI Unit</th>
            <th className="px-3 py-2.5">
              <span className="flex items-center gap-2">
                Target Value
                <FillDownButton onClick={() => fillColumnDown("target_value")} />
              </span>
            </th>
            <th className="px-3 py-2.5">
              <span className="flex items-center gap-2">
                Setup Date
                <FillDownButton onClick={() => fillColumnDown("target_setup_date")} />
              </span>
            </th>
            <th className="px-3 py-2.5">Responsible</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((scopeEntry) => {
            const scopeEntryKind = scopeEntry.row_kind || "unit";
            const scopeId = String(
              scopeEntryKind === "unit"
                ? scopeEntry.unit_id || scopeEntry.value || ""
                : scopeEntry.value || ""
            ).trim();

            const state = resolveEditModeUnitState(
              getParameterUnitState(unitState, scopeEntryKind, scopeId),
              { editMode, editAllocations, scopeKind: scopeEntryKind, scopeId }
            );

            const resolvedResponsible = resolveParameterResponsibleEntry(
              ctx,
              form,
              scopeEntry,
              state
            );
            const responsibleLabel = resolvedResponsible?.label || "";
            const responsiblePlaceholder =
              scopeKind === "zone"
                ? "No responsible assigned"
                : getNormalizedParameterRoleId(selectedRoleId)
                  ? "No responsible assigned"
                  : "Enter the role please";
            const metaText = getParameterUnitMetaText(ctx, form, scopeEntry);

            return (
              <tr key={`${scopeEntryKind}:${scopeEntry.value}`} className="border-t border-slate-100">
                <td className="px-3 py-2.5 align-top">
                  <div className="font-semibold text-slate-800">{scopeEntry.label || ""}</div>
                  {metaText ? <div className="text-xs text-slate-400">{metaText}</div> : null}
                </td>
                {showSellCurrencyColumn ? (
                  <td className="px-3 py-2.5 align-top">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {scopeEntry.local_currency || "-"}
                    </span>
                  </td>
                ) : null}
                <td className="px-3 py-2.5 align-top">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {kpiUnit || "-"}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <input
                    className={inputClass}
                    type="number"
                    step="any"
                    placeholder="Enter target value"
                    value={state.target_value ?? ""}
                    onChange={(e) => setRowState(scopeEntry, { target_value: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <input
                    className={inputClass}
                    type="date"
                    value={
                      normalizeParameterDateValue(
                        state.target_setup_date ?? form.parameter_target_setup_date
                      ) || getLocalDateInputValue()
                    }
                    onChange={(e) => setRowState(scopeEntry, { target_setup_date: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <div
                    className={`${readonlyInputClass} ${responsibleLabel ? "" : "text-slate-400"}`}
                    title={responsibleLabel || responsiblePlaceholder}
                  >
                    {responsibleLabel || responsiblePlaceholder}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FillDownButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Copy the first row's value into every row of this column"
      className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold normal-case text-slate-500 hover:bg-slate-100"
    >
      Fill down
    </button>
  );
}

function MatrixEmpty({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

// Target-allocation (the original page calls them "parameter KPIs") logic,
// ported from the client-side script of GET /responsible/:responsibleId/dashboard
// (KPI-Group/index.js:8548-24318).
//
// The original kept all of this in DOM-reading globals; here every function is
// pure and takes an explicit context:
//   ctx = { lookups, roleOptions }
//   form = { parameter_* fields }              (same field names as the original)
//   unitState = { "<scopeKind>:<scopeId>": {...} }   (parameterUnitTargetState)
//
// NOTE on dead code deliberately not reproduced (see the final report):
//  * getParameterUnitAllocationRows() nests an `if (isRoleParameterScope())`
//    block inside its `if (isIndividualParameterScope())` branch. The two are
//    mutually exclusive (both read parameter_kpi_type), so that block is
//    unreachable.
//  * buildSingleProductLineAllocationRow() is never called anywhere.
//  * saveParameterKpi() repeats its `if (missingRow)` guard after the branch
//    that already returned, so the second copy is unreachable.
//  * Earlier duplicate definitions of getParameterVisibleUnitRows,
//    renderMultisiteUnitMatrix, syncIndividualResponsibleOptions,
//    autoFillSetByFromUnit and handleCalculationOnChange are shadowed by later
//    ones through function hoisting; only the last definition ever runs, and
//    only that one is ported.

import {
  getLastPathSegment,
  getLocalDateInputValue,
  normalizeParameterDateValue,
  splitParameterPath,
} from "./formatting.js";

export const PARAMETER_ZONE_ALL_ROLE_VALUE = "__all_roles__";

export const PARAMETER_KPI_TYPE_OPTIONS = [
  "Multisite",
  "Individual",
  "Zone",
  "Product Line",
  "Role",
];

export const PARAMETER_TARGET_STATUS_OPTIONS = ["Draft", "Active", "Approved", "Closed"];

export const PARAMETER_FORM_DEFAULTS = Object.freeze({
  parameter_object_id: "",
  parameter_kpi_id: "",
  parameter_kpi_type: "",
  parameter_unit_type_id: "",
  parameter_role_id: "",
  parameter_role_target_mode: "",
  parameter_target_status: "Draft",
  parameter_plant_id: "",
  parameter_zone_id: "",
  parameter_unit_id: "",
  parameter_function: "",
  parameter_product_line_id: "",
  parameter_product_id: "",
  parameter_market_id: "",
  parameter_customer_id: "",
  parameter_target_value: "",
  parameter_target_unit: "",
  parameter_local_currency: "",
  parameter_last_best_target: "",
  parameter_previous_target_value: "",
  parameter_target_setup_date: "",
  parameter_target_start_date: "",
  parameter_target_end_date: "",
  parameter_set_by_people_id: "",
  parameter_approved_by_people_id: "",
  parameter_comments: "",
});

// ---------------------------------------------------------------------------
// Scope kind
// ---------------------------------------------------------------------------

export function getParameterScopeKind(form) {
  const type = String(form.parameter_kpi_type || "").trim().toLowerCase();
  if (type === "zone") return "zone";
  if (type === "product line") return "product_line";
  if (type === "role") return "role";
  return "unit";
}

export function isIndividualParameterScope(form) {
  return String(form.parameter_kpi_type || "").trim().toLowerCase() === "individual";
}

export function isRoleParameterScope(form) {
  return String(form.parameter_kpi_type || "").trim().toLowerCase() === "role";
}

export function isRoleApplyAllMode(form) {
  return isRoleParameterScope(form) && String(form.parameter_role_target_mode || "") === "apply_all";
}

export function getNormalizedParameterRoleId(roleId) {
  const normalizedRoleId = String(roleId || "").trim();
  if (normalizedRoleId === PARAMETER_ZONE_ALL_ROLE_VALUE) return "";
  return normalizedRoleId;
}

// ---------------------------------------------------------------------------
// Lookup accessors
// ---------------------------------------------------------------------------

export function getParameterAllocationUnits(lookups) {
  const assignmentUnits = Array.isArray(lookups.multisiteAssignments)
    ? lookups.multisiteAssignments
    : [];
  if (assignmentUnits.length) return assignmentUnits;

  const plainUnits = Array.isArray(lookups.units) ? lookups.units : [];
  return plainUnits.map((unitEntry) => ({
    value: unitEntry.value,
    label: unitEntry.label,
    unit_type_id: unitEntry.unit_type_id ?? null,
    unit_type_name: unitEntry.unit_type_name || "",
    selling_currency: unitEntry.selling_currency || "",
    operating_currency: unitEntry.operating_currency || "",
    responsibles: [],
  }));
}

export function getParameterUnitById(lookups, unitId) {
  const normalizedUnitId = String(unitId || "").trim();
  if (!normalizedUnitId) return null;
  return (
    getParameterAllocationUnits(lookups).find(
      (unitEntry) => String(unitEntry.value || "") === normalizedUnitId
    ) || null
  );
}

export function getParameterPeopleLabel(lookups, peopleId) {
  const normalizedPeopleId = String(peopleId || "").trim();
  if (!normalizedPeopleId) return "";
  const matchedPerson = (lookups.people || []).find(
    (option) => String(option.value || "") === normalizedPeopleId
  );
  return String(matchedPerson?.label || `Person ${normalizedPeopleId}`).trim();
}

export function getParameterRoleLabel(roleOptions, roleId) {
  const normalizedRoleId = String(roleId || "").trim();
  if (!normalizedRoleId) return "";
  if (normalizedRoleId === PARAMETER_ZONE_ALL_ROLE_VALUE) return "All roles";

  const matchedRole = (roleOptions || []).find(
    (option) => String(option.value || "") === normalizedRoleId
  );
  return String(matchedRole?.label || "").split(" · ")[0].trim();
}

export function getParameterKpiById(kpiCatalog, kpiId) {
  return (kpiCatalog || []).find((kpi) => String(kpi.kpi_id) === String(kpiId)) || null;
}

export function getParameterSelectedKpiUnit(kpiCatalog, form) {
  return String(getParameterKpiById(kpiCatalog, form.parameter_kpi_id)?.unit || "").trim();
}

export function getParameterUnitsForSelectedUnitType(ctx, form, { includeAllWhenEmpty = false } = {}) {
  const selectedUnitTypeId = String(form.parameter_unit_type_id || "").trim();
  const allUnits = getParameterAllocationUnits(ctx.lookups);
  if (!selectedUnitTypeId) return includeAllWhenEmpty ? allUnits.slice() : [];
  return allUnits.filter((unitEntry) => String(unitEntry?.unit_type_id ?? "") === selectedUnitTypeId);
}

export function getParameterRoleOptionsForSelectedUnitType(ctx, form) {
  const roleMap = new Map();
  getParameterUnitsForSelectedUnitType(ctx, form).forEach((unitEntry) => {
    (Array.isArray(unitEntry?.responsibles) ? unitEntry.responsibles : []).forEach((entry) => {
      const roleId = String(entry?.role_id || "").trim();
      if (!roleId) return;
      if (!roleMap.has(roleId)) {
        roleMap.set(roleId, {
          value: roleId,
          label:
            String(entry?.role_name || "").trim() ||
            getParameterRoleLabel(ctx.roleOptions, roleId) ||
            `Role ${roleId}`,
        });
      }
    });
  });
  return Array.from(roleMap.values()).sort((left, right) =>
    String(left.label || "").localeCompare(String(right.label || ""))
  );
}

// populateParameterRoleScopeOptions(): which role options the Role dropdown
// offers, per scope. Returns { options, placeholder }.
export function getParameterRoleScopeOptions(ctx, form) {
  const scopeKind = getParameterScopeKind(form);

  if (scopeKind === "zone") {
    const zoneRoleMap = new Map();
    (ctx.lookups.peopleRoleAssignments || [])
      .filter((a) => String(a.zone_id || "").trim())
      .forEach((a) => {
        const roleId = String(a.role_id || "").trim();
        if (!roleId) return;
        if (!zoneRoleMap.has(roleId)) {
          zoneRoleMap.set(roleId, {
            value: roleId,
            label: a.role_name || getParameterRoleLabel(ctx.roleOptions, roleId) || `Role ${roleId}`,
          });
        }
      });

    return {
      options: [
        { value: PARAMETER_ZONE_ALL_ROLE_VALUE, label: "All roles" },
        ...Array.from(zoneRoleMap.values()).sort((a, b) =>
          String(a.label || "").localeCompare(String(b.label || ""))
        ),
      ],
      placeholder: "Select role",
    };
  }

  if (scopeKind === "unit" && !isIndividualParameterScope(form)) {
    const options = getParameterRoleOptionsForSelectedUnitType(ctx, form);
    return {
      options,
      placeholder: form.parameter_unit_type_id
        ? options.length
          ? "Select role"
          : "No roles for selected unit type"
        : "Select unit type first",
    };
  }

  return { options: ctx.roleOptions || [], placeholder: "Select role" };
}

// Zone scope hides the group / country pseudo units.
export function getParameterZoneUnitOptions(lookups) {
  const hiddenZoneUnits = new Set([
    "avocarbon group",
    "france",
    "china",
    "tunisia",
    "germany",
    "europe",
    "americas",
    "asia",
  ]);
  const rawOptions = lookups.units || lookups.plants || [];
  return rawOptions.filter((option) => {
    const normalizedLabel = String(option?.label || "").trim().toLowerCase();
    return normalizedLabel && !hiddenZoneUnits.has(normalizedLabel);
  });
}

// ---------------------------------------------------------------------------
// Per-row target state keys
// ---------------------------------------------------------------------------

export function getParameterRowStateKey(scopeType, scopeId) {
  const normalizedScopeType = String(scopeType || "unit").trim().toLowerCase() || "unit";
  const normalizedScopeId = String(scopeId || "").trim();
  if (!normalizedScopeId) return "";
  return `${normalizedScopeType}:${normalizedScopeId}`;
}

export function getParameterUnitState(unitState, scopeType, scopeId) {
  return unitState[getParameterRowStateKey(scopeType, scopeId)] || {};
}

export function setParameterUnitState(unitState, scopeType, scopeId, patch = {}) {
  const key = getParameterRowStateKey(scopeType, scopeId);
  if (!key) return unitState;
  return { ...unitState, [key]: { ...(unitState[key] || {}), ...patch } };
}

export function getRoleRowScopeId(unitId, peopleId) {
  return `${String(unitId || "").trim()}:${String(peopleId || "").trim()}`;
}

export function getPeopleAssignmentScopeId(scopeKind, scopeId, peopleId) {
  const normalizedScopeKind = String(scopeKind || "").trim();
  const normalizedScopeId = String(scopeId || "").trim();
  const normalizedPeopleId = String(peopleId || "").trim();
  if (!normalizedScopeKind || !normalizedScopeId) return "";
  if (!normalizedPeopleId) return normalizedScopeId;
  return `${normalizedScopeKind}:${normalizedScopeId}:people:${normalizedPeopleId}`;
}

export function inferParameterRoleIdFromAllocation(lookups, row, rows = []) {
  const sourceRows = [row, ...(Array.isArray(rows) ? rows : [])];
  for (const allocationRow of sourceRows) {
    const peopleId = String(allocationRow?.set_by_people_id || "").trim();
    const unitId = String(allocationRow?.plant_id || allocationRow?.unit_id || "").trim();
    const zoneId = String(allocationRow?.zone_id || "").trim();
    if (!peopleId) continue;

    const matchedAssignment = (lookups.peopleRoleAssignments || []).find((a) => {
      if (String(a.people_id || "").trim() !== peopleId) return false;
      if (zoneId) return String(a.zone_id || "").trim() === zoneId;
      if (unitId) return String(a.unit_id || "").trim() === unitId;
      return false;
    });

    if (matchedAssignment?.role_id) return String(matchedAssignment.role_id);
  }
  return "";
}

// initializeParameterUnitTargetState(): rebuild the per-row target state from
// the allocations being edited.
export function initializeParameterUnitTargetState(rows = []) {
  let unitState = {};

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const isProductLine = String(row?.kpi_type || "").trim().toLowerCase() === "product line";

    // Product Line allocations store their per-product-line targets as JSON in
    // the comments column (original behaviour, kept as-is).
    if (isProductLine && row.comments) {
      try {
        const parsed = JSON.parse(row.comments);
        const targets = Array.isArray(parsed.product_line_targets)
          ? parsed.product_line_targets
          : [];

        targets.forEach((targetRow) => {
          const productLineId = String(targetRow.product_line_id || "").trim();
          if (!productLineId) return;
          unitState = setParameterUnitState(unitState, "product_line", productLineId, {
            kpi_target_allocation_id: row.kpi_target_allocation_id ?? "",
            target_value: targetRow.target_value ?? "",
            target_setup_date:
              normalizeParameterDateValue(targetRow.target_setup_date) || getLocalDateInputValue(),
            responsible_id: targetRow.responsible_people_id ?? "",
            set_by_people_id: targetRow.responsible_people_id ?? "",
          });
        });
        return;
      } catch {
        // Invalid product line comments JSON -- fall through to the generic path.
      }
    }

    const normalizedKpiType = String(row?.kpi_type || "").trim().toLowerCase();
    const peopleId = String(row?.set_by_people_id || "").trim();

    let scopeType;
    let scopeId;

    if (normalizedKpiType === "role") {
      scopeType = "role";
      scopeId = getRoleRowScopeId(row?.plant_id || row?.unit_id, peopleId);
    } else if (row?.product_line_id) {
      scopeType = "product_line";
      scopeId = String(row.product_line_id);
    } else if (row?.zone_id) {
      scopeType = "zone";
      scopeId = getPeopleAssignmentScopeId("zone", row.zone_id, peopleId);
    } else {
      // Multisite / unit targets are indexed directly by unit id.
      scopeType = "unit";
      scopeId = String(row?.plant_id ?? row?.unit_id ?? "").trim();
    }

    if (!scopeId) return;

    unitState = setParameterUnitState(unitState, scopeType, scopeId, {
      kpi_target_allocation_id: row.kpi_target_allocation_id ?? "",
      target_value: row.target_value ?? "",
      local_currency: row.local_currency ?? "",
      target_setup_date:
        normalizeParameterDateValue(row?.target_setup_date) || getLocalDateInputValue(),
      set_by_people_id: row.set_by_people_id ?? "",
      responsible_id: row.set_by_people_id ?? "",
      last_best_target: row.last_best_target ?? "",
      approved_by_id: row.approved_by_people_id ?? "",
    });
  });

  return unitState;
}

// ---------------------------------------------------------------------------
// Visible matrix rows per scope
// ---------------------------------------------------------------------------

export function getParameterVisibleUnitRows(ctx, form, { lockedUnitId = "" } = {}) {
  const { lookups, roleOptions } = ctx;
  const scopeKind = getParameterScopeKind(form);

  if (scopeKind === "role") {
    const roleId = getNormalizedParameterRoleId(form.parameter_role_id);
    if (!roleId) return [];

    const unitsById = new Map(
      getParameterAllocationUnits(lookups).map((unit) => [
        String(unit.value || unit.unit_id || ""),
        unit,
      ])
    );

    return (lookups.peopleRoleAssignments || [])
      .filter((a) => String(a.role_id || "").trim() === String(roleId))
      .filter((a) => String(a.unit_id || "").trim())
      .map((a) => {
        const unit = unitsById.get(String(a.unit_id || ""));
        if (!unit) return null;

        const peopleId = String(a.people_id || a.value || "").trim();
        if (!peopleId) return null;

        const responsibleLabel =
          a.label || getParameterPeopleLabel(lookups, peopleId) || `Person ${peopleId}`;

        return {
          row_kind: "role",
          value: getRoleRowScopeId(String(a.unit_id), peopleId),
          people_id: peopleId,
          label:
            String(unit.label || "").trim() ||
            String(unit.unit_name || "").trim() ||
            `Unit ${a.unit_id}`,
          unit_id: String(a.unit_id),
          unit_type_id: unit.unit_type_id || null,
          unit_type_name: unit.unit_type_name || "",
          selling_currency: unit.selling_currency || "",
          operating_currency: unit.operating_currency || "",
          local_currency: unit.selling_currency || unit.operating_currency || "",
          responsible_people_id: peopleId,
          responsible_label: responsibleLabel,
          responsibles: [
            {
              people_id: peopleId,
              label: responsibleLabel,
              role_id: a.role_id,
              role_name: a.role_name || "",
              is_primary: Boolean(a.is_primary),
            },
          ],
        };
      })
      .filter(Boolean)
      .sort(
        (left, right) =>
          String(left.label || "").localeCompare(String(right.label || "")) ||
          String(left.responsible_label || "").localeCompare(String(right.responsible_label || ""))
      );
  }

  if (scopeKind === "product_line") {
    return (lookups.productLines || []).map((productLine) => ({
      row_kind: "product_line",
      value: String(productLine.value || productLine.product_line_id || ""),
      label: productLine.label || productLine.product_line_name || "",
      local_currency: "",
      responsible_people_id: productLine.responsible_people_id || "",
      responsable_product_line: productLine.responsable_product_line || "",
      responsibles: Array.isArray(productLine.responsibles) ? productLine.responsibles.slice() : [],
    }));
  }

  if (scopeKind === "zone") {
    const normalizedRoleId = getNormalizedParameterRoleId(form.parameter_role_id);

    return (lookups.peopleRoleAssignments || [])
      .filter((a) => String(a.zone_id || "").trim())
      .filter((a) => !normalizedRoleId || String(a.role_id || "").trim() === normalizedRoleId)
      .map((a) => {
        const zone = (lookups.zones || []).find(
          (z) => String(z.value || z.zone_id || "").trim() === String(a.zone_id || "").trim()
        );
        const peopleId = String(a.people_id || a.value || "").trim();
        const label = a.label || getParameterPeopleLabel(lookups, peopleId) || `Person ${peopleId}`;

        return {
          row_kind: "zone",
          value: `zone:${a.zone_id}:people:${peopleId}`,
          zone_id: String(a.zone_id),
          label: (zone && (zone.label || zone.zone_name)) || `Zone ${a.zone_id}`,
          local_currency: "",
          people_id: peopleId,
          responsible_people_id: peopleId,
          responsable_zone: label,
          responsible_label: label,
          responsibles: [
            {
              people_id: peopleId,
              label,
              role_id: a.role_id,
              role_name: a.role_name || "",
              is_primary: Boolean(a.is_primary),
            },
          ],
        };
      });
  }

  const selectedUnitTypeId = String(form.parameter_unit_type_id || "").trim();
  const normalizedRoleId = getNormalizedParameterRoleId(form.parameter_role_id);

  if (normalizedRoleId) {
    return (lookups.peopleRoleAssignments || [])
      .filter((a) => String(a.role_id || "").trim() === normalizedRoleId)
      .filter((a) => String(a.unit_id || "").trim())
      .filter((a) => !selectedUnitTypeId || String(a.unit_type_id || "").trim() === selectedUnitTypeId)
      .map((a) => {
        const unitId = String(a.unit_id || "").trim();
        const peopleId = String(a.people_id || a.value || "").trim();
        if (!unitId || !peopleId) return null;

        const responsibleLabel =
          a.label || getParameterPeopleLabel(lookups, peopleId) || `Person ${peopleId}`;

        return {
          row_kind: "unit",
          value: `unit:${unitId}:people:${peopleId}`,
          unit_id: unitId,
          people_id: peopleId,
          label: a.unit_name || `Unit ${unitId}`,
          unit_type_id: a.unit_type_id || null,
          unit_type_name: a.unit_type_name || "",
          selling_currency: a.selling_currency || "",
          operating_currency: a.operating_currency || "",
          local_currency: a.selling_currency || a.operating_currency || "",
          responsible_people_id: peopleId,
          responsible_label: responsibleLabel,
          responsibles: [
            {
              people_id: peopleId,
              label: responsibleLabel,
              role_id: a.role_id,
              role_name: a.role_name || "",
              is_primary: Boolean(a.is_primary),
            },
          ],
        };
      })
      .filter(Boolean);
  }

  const selectedUnits = getParameterUnitsForSelectedUnitType(ctx, form, {
    includeAllWhenEmpty: Boolean(lockedUnitId),
  }).map((unitEntry) => ({
    ...unitEntry,
    row_kind: "unit",
    local_currency: unitEntry.selling_currency || unitEntry.operating_currency || "",
  }));

  if (lockedUnitId) {
    return selectedUnits.filter((unitEntry) => String(unitEntry.value || "") === String(lockedUnitId));
  }

  // roleOptions unused here; kept in ctx for the other branches.
  void roleOptions;
  return selectedUnits;
}

// ---------------------------------------------------------------------------
// Responsible resolution
// ---------------------------------------------------------------------------

export function getParameterMatchedResponsible(unitEntry, roleId) {
  if (!unitEntry || !Array.isArray(unitEntry.responsibles)) return null;

  const normalizedRoleId = String(roleId || "").trim();
  const responsibles = unitEntry.responsibles
    .filter((entry) => entry && entry.people_id)
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)));

  if (!normalizedRoleId) return null;
  return responsibles.find((entry) => String(entry.role_id || "") === normalizedRoleId) || null;
}

export function getParameterRoleResponsibleCandidates(ctx, roleId) {
  const normalizedRoleId = String(roleId || "").trim();
  if (!normalizedRoleId) return [];

  const candidateMap = new Map();
  (ctx.lookups.peopleRoleAssignments || []).forEach((assignment) => {
    const assignmentRoleId = String(assignment.role_id || "").trim();
    const peopleId = String(assignment.people_id || assignment.value || "").trim();
    if (!peopleId) return;
    if (assignmentRoleId !== normalizedRoleId) return;

    const existingEntry = candidateMap.get(peopleId);
    if (!existingEntry || (Boolean(assignment.is_primary) && !existingEntry.is_primary)) {
      candidateMap.set(peopleId, {
        people_id: peopleId,
        value: peopleId,
        label:
          assignment.label ||
          getParameterPeopleLabel(ctx.lookups, peopleId) ||
          `Person ${peopleId}`,
        role_id: assignment.role_id,
        role_name: assignment.role_name || "",
        is_primary: Boolean(assignment.is_primary),
      });
    }
  });

  return Array.from(candidateMap.values()).sort((left, right) => {
    const primaryDiff = Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary));
    if (primaryDiff !== 0) return primaryDiff;
    return String(left.label || "").localeCompare(String(right.label || ""));
  });
}

export function resolveParameterResponsibleEntry(ctx, form, scopeEntry, state = null) {
  if (!scopeEntry) return null;

  const scopeKind = scopeEntry.row_kind || "unit";
  const rowState = state || {};
  const matchedResponsible = getParameterMatchedResponsible(scopeEntry, form.parameter_role_id);

  if (matchedResponsible?.people_id) {
    return {
      ...matchedResponsible,
      people_id: String(matchedResponsible.people_id),
      label:
        matchedResponsible.label ||
        getParameterPeopleLabel(ctx.lookups, matchedResponsible.people_id) ||
        `Person ${matchedResponsible.people_id}`,
      source: "role",
    };
  }

  if (scopeKind === "zone") {
    const explicitPeopleId = String(
      rowState?.set_by_people_id || rowState?.responsible_id || ""
    ).trim();
    if (explicitPeopleId) {
      return {
        people_id: explicitPeopleId,
        label:
          getParameterPeopleLabel(ctx.lookups, explicitPeopleId) || `Person ${explicitPeopleId}`,
        source: "zone-explicit",
      };
    }

    const zoneResponsiblePeopleId = String(
      scopeEntry.responsible_people_id || rowState?.responsible_people_id || ""
    ).trim();
    const zoneResponsibleLabel = String(
      scopeEntry.responsable_zone || rowState?.responsable_zone || ""
    ).trim();

    if (zoneResponsiblePeopleId) {
      return {
        people_id: zoneResponsiblePeopleId,
        label:
          zoneResponsibleLabel ||
          getParameterPeopleLabel(ctx.lookups, zoneResponsiblePeopleId) ||
          `Person ${zoneResponsiblePeopleId}`,
        source: "zone-assignment",
      };
    }
    if (zoneResponsibleLabel) {
      return { people_id: "", label: zoneResponsibleLabel, source: "zone-assignment-label" };
    }
  }

  if (scopeKind === "product_line") {
    const productLineResponsiblePeopleId = String(
      scopeEntry.responsible_people_id || rowState?.responsible_people_id || ""
    ).trim();
    const productLineResponsibleLabel = String(
      scopeEntry.responsable_product_line || rowState?.responsable_product_line || ""
    ).trim();

    if (productLineResponsiblePeopleId) {
      return {
        people_id: productLineResponsiblePeopleId,
        label:
          productLineResponsibleLabel ||
          getParameterPeopleLabel(ctx.lookups, productLineResponsiblePeopleId) ||
          `Person ${productLineResponsiblePeopleId}`,
        source: "product-line-assignment",
      };
    }
    if (productLineResponsibleLabel) {
      return {
        people_id: "",
        label: productLineResponsibleLabel,
        source: "product-line-assignment-label",
      };
    }
  }

  return null;
}

// getAutoResolvedIndividualResponsibleEntry()
export function getAutoResolvedIndividualResponsibleEntry(ctx, form, { lockedUnitId = "" } = {}) {
  const normalizedRoleId = getNormalizedParameterRoleId(form.parameter_role_id);
  if (!normalizedRoleId) return null;

  const currentResponsibleId = String(form.parameter_set_by_people_id || "").trim();
  const selectedUnitId = String(form.parameter_plant_id || lockedUnitId || "").trim();

  if (selectedUnitId) {
    const unitEntry = getParameterUnitById(ctx.lookups, selectedUnitId);
    const unitMatch = getParameterMatchedResponsible(unitEntry, normalizedRoleId);
    if (unitMatch?.people_id) {
      return {
        ...unitMatch,
        people_id: String(unitMatch.people_id),
        label:
          unitMatch.label ||
          getParameterPeopleLabel(ctx.lookups, unitMatch.people_id) ||
          `Person ${unitMatch.people_id}`,
        source: "unit-role",
      };
    }
  }

  const fallbackCandidates = getParameterRoleResponsibleCandidates(ctx, normalizedRoleId);
  if (!fallbackCandidates.length) return null;

  if (currentResponsibleId) {
    const currentCandidate = fallbackCandidates.find(
      (entry) => String(entry?.people_id || "").trim() === currentResponsibleId
    );
    if (currentCandidate) return { ...currentCandidate, source: "role" };
  }

  if (fallbackCandidates.length === 1) return { ...fallbackCandidates[0], source: "role" };

  const primaryCandidates = fallbackCandidates.filter((entry) => Boolean(entry?.is_primary));
  if (primaryCandidates.length === 1) return { ...primaryCandidates[0], source: "role" };

  return null;
}

// syncIndividualResponsibleOptions(): which people the Responsible dropdown
// offers. Outside Individual scope the full people list is used.
export function getIndividualResponsibleOptions(ctx, form, { editMode, editAllocations } = {}) {
  const normalizedRoleId = getNormalizedParameterRoleId(form.parameter_role_id);

  if (!isIndividualParameterScope(form)) {
    return { options: ctx.lookups.people || [], placeholder: "Select person" };
  }
  if (!normalizedRoleId) {
    return { options: [], placeholder: "Select role first" };
  }

  const relatedPeople = getParameterRoleResponsibleCandidates(ctx, normalizedRoleId)
    .map((person) => ({
      value: String(person.people_id || ""),
      label: person.label || getParameterPeopleLabel(ctx.lookups, person.people_id) || "",
    }))
    .filter((person) => person.value);

  // An existing allocation stays assigned to its saved owner even if that
  // person is no longer returned by the current role-assignment lookup.
  const savedAllocation = editMode
    ? (editAllocations || []).find(
        (row) =>
          String(row.kpi_target_allocation_id) === String(form.parameter_object_id)
      )
    : null;
  const savedResponsibleId = String(savedAllocation?.set_by_people_id || "");
  const preferredValue = String(form.parameter_set_by_people_id || "");

  if (
    savedResponsibleId &&
    preferredValue === savedResponsibleId &&
    String(savedAllocation?.role_id || "") === String(normalizedRoleId) &&
    !relatedPeople.some((person) => person.value === savedResponsibleId)
  ) {
    relatedPeople.push({
      value: savedResponsibleId,
      label:
        savedAllocation.set_by_people_display_name ||
        getParameterPeopleLabel(ctx.lookups, savedResponsibleId) ||
        `Person ${savedResponsibleId}`,
    });
  }

  return {
    options: relatedPeople,
    placeholder: relatedPeople.length ? "Select related responsible" : "No responsible",
  };
}

export function getParameterUnitMetaText(ctx, form, unitEntry) {
  if (!unitEntry) return "";
  if (unitEntry.row_kind === "zone") return "Zone from zone table";
  if (unitEntry.row_kind === "product_line") return "Product line target row";

  const parts = [];
  const roleLabel = getParameterRoleLabel(ctx.roleOptions, form.parameter_role_id);
  const matchedResponsible = getParameterMatchedResponsible(unitEntry, form.parameter_role_id);
  const localCurrency = unitEntry.selling_currency || unitEntry.operating_currency || "";

  if (unitEntry.unit_type_name) parts.push(unitEntry.unit_type_name);
  if (localCurrency) parts.push(`${localCurrency} currency`);
  if (matchedResponsible) {
    parts.push(`${roleLabel || matchedResponsible.role_name || "Role"}: ${matchedResponsible.label}`);
  } else if (roleLabel) {
    parts.push(`No active ${roleLabel} assigned`);
  }

  return parts.filter(Boolean).join(" • ");
}

export function isValidParameterPlantId(lookups, unitId) {
  const normalizedUnitId = String(unitId || "").trim();
  if (!normalizedUnitId) return false;

  if (
    getParameterAllocationUnits(lookups).some((unit) => String(unit.value || "") === normalizedUnitId)
  ) {
    return true;
  }

  return (lookups.roleScopeAssignments || lookups.peopleRoleAssignments || []).some(
    (assignment) => String(assignment.unit_id || "").trim() === normalizedUnitId
  );
}

// ---------------------------------------------------------------------------
// Role "Apply All" shared row
// ---------------------------------------------------------------------------

export function getRoleApplyAllSharedTargetValue(form, unitState, visibleRows = []) {
  const primaryTargetValue = String(form.parameter_target_value || "").trim();
  if (primaryTargetValue) return primaryTargetValue;

  for (const row of visibleRows) {
    const state = getParameterUnitState(unitState, row.row_kind || "role", row.value);
    const stateTargetValue = String(state.target_value ?? "").trim();
    if (stateTargetValue) return stateTargetValue;
  }
  return "";
}

export function getRoleApplyAllSharedSetupDateValue(form, unitState, visibleRows = []) {
  const primary = normalizeParameterDateValue(form.parameter_target_setup_date);
  if (primary) return primary;

  for (const row of visibleRows) {
    const state = getParameterUnitState(unitState, row.row_kind || "role", row.value);
    const stateDate = normalizeParameterDateValue(state.target_setup_date);
    if (stateDate) return stateDate;
  }
  return getLocalDateInputValue();
}

export function getRoleApplyAllUnitSummary(visibleRows = []) {
  const unitNames = Array.from(
    new Set(visibleRows.map((row) => String(row.label || "").trim()).filter(Boolean))
  );
  const unitCount = unitNames.length;
  const preview =
    unitNames.length > 3
      ? `${unitNames.slice(0, 3).join(", ")} +${unitNames.length - 3}`
      : unitNames.join(", ");

  return {
    title: unitCount ? `${unitCount} unit${unitCount === 1 ? "" : "s"}` : "Related units",
    detail: preview || "Units linked to the selected role",
  };
}

// syncRoleApplyAllRowState(): write the shared value into every visible row,
// normalizing the setup date exactly like the original did.
export function applyRoleApplyAllPatch(unitState, visibleRows = [], patch = {}) {
  const rowPatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, "target_value")) {
    rowPatch.target_value = String(patch.target_value ?? "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "target_setup_date")) {
    rowPatch.target_setup_date = normalizeParameterDateValue(patch.target_setup_date) || "";
  }
  if (!Object.keys(rowPatch).length) return unitState;

  let nextState = unitState;
  visibleRows.forEach((row) => {
    nextState = setParameterUnitState(nextState, row.row_kind || "role", row.value, rowPatch);
  });
  return nextState;
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

export function getParameterUnitAllocationRows(ctx, form, unitState, options = {}) {
  const { lockedUnitId = "", editMode = false, kpiCatalog = [] } = options;
  const kpiUnit = getParameterSelectedKpiUnit(kpiCatalog, form);
  const sharedRoleId = getNormalizedParameterRoleId(form.parameter_role_id);
  const sharedUnitTypeId = form.parameter_unit_type_id;
  const fallbackSetupDate =
    normalizeParameterDateValue(form.parameter_target_setup_date) || getLocalDateInputValue();

  if (isIndividualParameterScope(form)) {
    const plantId = String(form.parameter_plant_id || lockedUnitId || "").trim();
    const unitEntry = plantId ? getParameterUnitById(ctx.lookups, plantId) : null;
    const existingState = plantId ? getParameterUnitState(unitState, "unit", plantId) : {};

    const targetValue = String(form.parameter_target_value || "").trim();
    const selectedResponsibleId = String(form.parameter_set_by_people_id || "").trim();

    if (!targetValue) return [];

    return [
      {
        kpi_target_allocation_id: String(existingState.kpi_target_allocation_id ?? "").trim() || null,
        plant_id: plantId || null,
        zone_id: null,
        unit_id: null,
        product_line_id: null,
        product_id: null,
        unit_type_id: sharedUnitTypeId || String(unitEntry?.unit_type_id || "").trim() || null,
        role_id: sharedRoleId || null,
        target_value: targetValue,
        target_setup_date:
          normalizeParameterDateValue(form.parameter_target_setup_date) || fallbackSetupDate,
        target_unit: form.parameter_target_unit || kpiUnit,
        local_currency:
          form.parameter_local_currency ||
          unitEntry?.selling_currency ||
          unitEntry?.operating_currency ||
          "",
        set_by_people_id: selectedResponsibleId || null,
        last_best_target: form.parameter_last_best_target || null,
        approved_by_people_id: form.parameter_approved_by_people_id || null,
      },
    ];
  }

  const visibleRows = getParameterVisibleUnitRows(ctx, form, { lockedUnitId });

  if (isRoleParameterScope(form)) {
    const applyAllTarget = String(form.parameter_target_value || "").trim();

    return visibleRows
      .map((scopeEntry) => {
        const scopeId = String(scopeEntry.value || "").trim();
        const state = getParameterUnitState(unitState, "role", scopeId);
        const resolvedResponsible = resolveParameterResponsibleEntry(ctx, form, scopeEntry, state);
        const responsiblePeopleId = String(
          resolvedResponsible?.people_id || scopeEntry.people_id || ""
        ).trim();

        // In edit mode, update existing rows only -- never insert new role rows.
        if (editMode && !state.kpi_target_allocation_id) return null;
        if (!isValidParameterPlantId(ctx.lookups, scopeEntry.unit_id)) return null;

        const targetValue = isRoleApplyAllMode(form)
          ? applyAllTarget || String(state.target_value ?? "").trim()
          : String(state.target_value ?? "").trim();

        if (!targetValue) return null;

        return {
          kpi_target_allocation_id: String(state.kpi_target_allocation_id ?? "").trim() || null,
          plant_id: String(scopeEntry.unit_id),
          zone_id: null,
          unit_id: null,
          product_line_id: null,
          product_id: null,
          unit_type_id: String(scopeEntry.unit_type_id || "").trim() || null,
          role_id: sharedRoleId || null,
          target_value: targetValue,
          target_setup_date:
            normalizeParameterDateValue(state.target_setup_date) || fallbackSetupDate,
          target_unit: kpiUnit,
          local_currency: scopeEntry.local_currency || "",
          set_by_people_id: responsiblePeopleId || null,
          last_best_target: String(state.last_best_target ?? "").trim() || null,
          approved_by_people_id: String(state.approved_by_id ?? "").trim() || null,
        };
      })
      .filter(Boolean);
  }

  return visibleRows
    .map((scopeEntry) => {
      const scopeKind = scopeEntry.row_kind || "unit";
      const scopeId = String(
        scopeKind === "unit" ? scopeEntry.unit_id || scopeEntry.value || "" : scopeEntry.value || ""
      ).trim();

      const state = getParameterUnitState(unitState, scopeKind, scopeId);
      const resolvedResponsible = resolveParameterResponsibleEntry(ctx, form, scopeEntry, state);
      const rowResponsibleId = String(resolvedResponsible?.people_id || "").trim();
      const targetValue = String(state.target_value ?? "").trim();
      const targetSetupDate =
        normalizeParameterDateValue(state.target_setup_date) || fallbackSetupDate;

      if (!targetValue) return null;

      return {
        kpi_target_allocation_id: String(state.kpi_target_allocation_id ?? "").trim() || null,
        plant_id: scopeKind === "unit" ? String(scopeEntry.unit_id || "").trim() || null : null,
        zone_id: scopeKind === "zone" ? String(scopeEntry.zone_id || "").trim() || null : null,
        product_line_id: null,
        unit_id: scopeKind === "unit" ? String(scopeEntry.unit_id || "").trim() || null : null,
        product_id:
          scopeKind === "zone" || scopeKind === "product_line" ? null : form.parameter_product_id,
        unit_type_id:
          scopeKind === "unit" || scopeKind === "role"
            ? sharedUnitTypeId || String(scopeEntry.unit_type_id || "")
            : null,
        role_id: sharedRoleId || null,
        target_value: targetValue,
        target_setup_date: targetSetupDate,
        target_unit: kpiUnit,
        local_currency: scopeKind === "unit" ? scopeEntry.local_currency || "" : "",
        set_by_people_id: rowResponsibleId || null,
        last_best_target: String(state.last_best_target ?? "").trim(),
        approved_by_people_id: String(state.approved_by_id ?? "").trim() || null,
      };
    })
    .filter(Boolean);
}

export function buildParameterPayload(ctx, form, unitState, options = {}) {
  const scopeKind = getParameterScopeKind(form);
  const isIndividualScope = isIndividualParameterScope(form);
  const unitAllocations = getParameterUnitAllocationRows(ctx, form, unitState, options);
  const primaryAllocation = unitAllocations[0] || null;
  const existingAllocationIds = options.existingAllocationIds || [];
  const roleId = scopeKind === "product_line" ? "" : getNormalizedParameterRoleId(form.parameter_role_id);

  return {
    kpi_target_allocation_id: form.parameter_object_id || "",
    kpi_id: form.parameter_kpi_id,
    kpi_type: form.parameter_kpi_type,
    unit_type_id:
      scopeKind === "zone" || scopeKind === "product_line" ? null : form.parameter_unit_type_id,
    role_id: roleId,
    role_target_mode: isRoleParameterScope(form) ? form.parameter_role_target_mode : null,
    target_status: form.parameter_target_status,
    plant_id:
      scopeKind === "product_line"
        ? null
        : primaryAllocation?.plant_id || form.parameter_plant_id,
    zone_id:
      scopeKind === "product_line" ? null : primaryAllocation?.zone_id || form.parameter_zone_id,
    function: form.parameter_function,
    product_line_id: null,
    unit_id: null,
    product_id: null,
    market_id: form.parameter_market_id,
    customer_id: form.parameter_customer_id,
    target_value: primaryAllocation?.target_value || form.parameter_target_value,
    target_unit: primaryAllocation?.target_unit || form.parameter_target_unit,
    local_currency: primaryAllocation?.local_currency || form.parameter_local_currency,
    last_best_target: form.parameter_last_best_target,
    previous_target_value: form.parameter_previous_target_value,
    target_setup_date: normalizeParameterDateValue(
      primaryAllocation?.target_setup_date || form.parameter_target_setup_date
    ),
    target_start_date: normalizeParameterDateValue(form.parameter_target_start_date),
    target_end_date: normalizeParameterDateValue(form.parameter_target_end_date),
    set_by_people_id: isIndividualScope
      ? form.parameter_set_by_people_id || null
      : primaryAllocation?.set_by_people_id || null,
    approved_by_people_id: form.parameter_approved_by_people_id,
    comments: form.parameter_comments,
    existing_allocation_ids: existingAllocationIds,
    unit_allocations: unitAllocations,
  };
}

// saveParameterKpi()'s validation chain, as a pure function returning the first
// error message (or null).
export function validateParameterForm(ctx, form, unitState, options = {}) {
  const { lockedUnitId = "" } = options;
  const scopeKind = getParameterScopeKind(form);

  if (!form.parameter_kpi_id) return "Select a KPI name first";
  if (!form.parameter_kpi_type) return "Select a KPI type";

  if (
    scopeKind !== "zone" &&
    scopeKind !== "product_line" &&
    !getNormalizedParameterRoleId(form.parameter_role_id)
  ) {
    return "Select the role first";
  }

  if (
    !isIndividualParameterScope(form) &&
    !isRoleParameterScope(form) &&
    scopeKind !== "zone" &&
    scopeKind !== "product_line" &&
    !form.parameter_unit_type_id &&
    !lockedUnitId
  ) {
    return "Select a unit type";
  }

  if (isIndividualParameterScope(form)) {
    const targetVal = form.parameter_target_value;
    if (!targetVal || Number.isNaN(Number(targetVal))) return "Target Value is required.";
    return null;
  }

  const visibleRows = getParameterVisibleUnitRows(ctx, form, { lockedUnitId });
  if (!visibleRows.length) {
    if (scopeKind === "zone") return "No zones are available from the zone table.";
    if (scopeKind === "role")
      return "No active people-role assignments with a unit_id were found for this role.";
    return "No units are available for the selected unit type.";
  }

  if (isRoleParameterScope(form) && isRoleApplyAllMode(form)) {
    const targetVal = String(form.parameter_target_value || "").trim();
    if (!targetVal || Number.isNaN(Number(targetVal))) {
      return "Target Value is required for Apply All mode.";
    }
    return null;
  }

  const missingRow = visibleRows.find((row) => {
    const rowKind = row.row_kind || "unit";
    const scopeId = String(
      rowKind === "unit" ? row.unit_id || row.value || "" : row.value || ""
    ).trim();
    const state = getParameterUnitState(unitState, rowKind, scopeId);
    const targetValue = String(state.target_value ?? "").trim();
    return targetValue === "" || !Number.isFinite(Number(targetValue));
  });

  if (missingRow) {
    if (isRoleParameterScope(form)) return "Target Value is required for every role row.";
    if (scopeKind === "zone") return "Target Value is required for every zone.";
    return "Target Value is required for every unit.";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Allocation list grouping (Consult Target Allocation section)
// ---------------------------------------------------------------------------

export function buildParameterAllocationGroupKey(row) {
  const type = String(row.kpi_type || "").trim().toLowerCase();

  // A Multisite allocation spans several DB rows (one per unit): plant/unit,
  // set_by_people and created_at must stay out of the group key.
  if (type === "multisite") {
    return [
      "multisite",
      row.kpi_id || "",
      row.unit_type_id || "",
      row.role_id || "",
      String(row.function || "").trim().toLowerCase(),
      row.product_id || "",
      row.product_line_id || "",
      row.market_id || "",
      row.customer_id || "",
      row.created_by_people_id || "",
    ].join("::");
  }

  if (type === "product line") {
    return [
      "product_line",
      row.kpi_id || "",
      row.market_id || "",
      row.customer_id || "",
      row.created_by_people_id || "",
    ].join("::");
  }

  const creationMarker =
    normalizeParameterDateValue(row.target_setup_date) ||
    String(row.created_at || "").slice(0, 10) ||
    `allocation:${String(row.kpi_target_allocation_id || "").trim()}`;

  return [
    row.kpi_id || "",
    type,
    row.unit_type_id || "",
    row.role_id || "",
    String(row.function || "").trim().toLowerCase(),
    row.product_id || "",
    row.product_line_id || "",
    row.market_id || "",
    row.customer_id || "",
    row.created_by_people_id || "",
    creationMarker,
  ].join("::");
}

export function buildParameterAllocationScopeKey(row) {
  if (!row || typeof row !== "object") return "";

  const normalizedType = String(row.kpi_type || "").trim().toLowerCase();
  if (normalizedType === "role") {
    const roleUnitId = String(row.plant_id || row.unit_id || "").trim();
    const rolePeopleId = String(row.set_by_people_id || row.responsible_people_id || "").trim();
    if (roleUnitId || rolePeopleId) return ["role", roleUnitId, rolePeopleId].join(":");
  }

  const productLineId = String(row.product_line_id || "").trim();
  if (productLineId) return `product_line:${productLineId}`;

  const peopleId = String(row.set_by_people_id || row.responsible_people_id || "").trim();

  const zoneId = String(row.zone_id || "").trim();
  if (zoneId) return `zone:${zoneId}${peopleId ? `:people:${peopleId}` : ""}`;

  const unitId = String(row.plant_id || row.unit_id || "").trim();
  if (unitId) return `unit:${unitId}${peopleId ? `:people:${peopleId}` : ""}`;

  const allocationId = String(row.kpi_target_allocation_id || "").trim();
  return allocationId ? `allocation:${allocationId}` : "";
}

export function mergeParameterAllocationCollections(...collections) {
  const mergedRows = new Map();
  collections
    .flat()
    .filter(Boolean)
    .forEach((row) => {
      const scopeKey = buildParameterAllocationScopeKey(row);
      const fallbackKey = `allocation:${String(row?.kpi_target_allocation_id || "").trim()}`;
      const key = scopeKey || fallbackKey;
      if (!key) return;
      mergedRows.set(key, { ...(mergedRows.get(key) || {}), ...row });
    });

  return Array.from(mergedRows.values()).sort(
    (left, right) =>
      Number(left?.kpi_target_allocation_id || 0) - Number(right?.kpi_target_allocation_id || 0)
  );
}

export function getParameterGroupedScopeKindLabel(row, count = 1) {
  const normalizedType = String(row?.kpi_type || "").trim().toLowerCase();
  let singularLabel = "unit";
  if (normalizedType === "zone") singularLabel = "zone";
  else if (normalizedType === "product line") singularLabel = "product line";
  else if (normalizedType === "role") singularLabel = "role";
  return count === 1 ? singularLabel : `${singularLabel}s`;
}

export function groupParameterAllocationRows(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const groupedRows = new Map();

  sourceRows.forEach((row) => {
    const groupKey = buildParameterAllocationGroupKey(row);
    if (!groupedRows.has(groupKey)) groupedRows.set(groupKey, []);
    groupedRows.get(groupKey).push(row);
  });

  return Array.from(groupedRows.values())
    .map((groupRows) => {
      const sortedGroupRows = groupRows
        .slice()
        .sort(
          (left, right) =>
            Number(left.kpi_target_allocation_id) - Number(right.kpi_target_allocation_id)
        );
      const primaryRow = sortedGroupRows[0] || {};
      const scopeNames = Array.from(
        new Set(
          sortedGroupRows
            .map(
              (row) =>
                row.product_line_name || row.zone_name || row.unit_name || row.plant_name || ""
            )
            .filter(Boolean)
        )
      );
      const responsibleNames = Array.from(
        new Set(sortedGroupRows.map((row) => row.set_by_people_display_name || "").filter(Boolean))
      );
      const currencies = Array.from(
        new Set(sortedGroupRows.map((row) => row.local_currency || "").filter(Boolean))
      );
      const targetValues = sortedGroupRows
        .map((row) => row.target_value)
        .filter((value) => value !== null && value !== undefined && value !== "");

      return {
        ...primaryRow,
        related_allocations: sortedGroupRows,
        group_row_count: sortedGroupRows.length,
        group_scope_names: scopeNames,
        group_responsible_names: responsibleNames,
        group_currencies: currencies,
        group_target_values: targetValues,
        local_currency: currencies.length === 1 ? currencies[0] : "",
        set_by_people_display_name:
          responsibleNames.length === 1
            ? responsibleNames[0]
            : primaryRow.set_by_people_display_name || "",
      };
    })
    .sort((left, right) => {
      const leftCreatedAt = new Date(left.created_at || 0).getTime();
      const rightCreatedAt = new Date(right.created_at || 0).getTime();
      if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt;
      return Number(right.kpi_target_allocation_id || 0) - Number(left.kpi_target_allocation_id || 0);
    });
}

export function buildParameterSearchFields(row) {
  const primaryFields = [
    row.kpi_subject,
    row.kpi_name,
    row.kpi_group,
    row.role_name,
    row.kpi_type,
    row.frequency,
  ];
  const relatedFields = Array.isArray(row.related_allocations)
    ? row.related_allocations.flatMap((allocationRow) => [
        allocationRow?.kpi_subject,
        allocationRow?.kpi_name,
        allocationRow?.kpi_group,
        allocationRow?.role_name,
        allocationRow?.kpi_type,
        allocationRow?.frequency,
      ])
    : [];

  return [...primaryFields, ...relatedFields]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

export function filterParameterRows(rows, search = "") {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const tokens = String(search || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return sourceRows;

  return sourceRows.filter((row) => {
    const searchFields = buildParameterSearchFields(row);
    return tokens.every((token) => searchFields.some((fieldValue) => fieldValue.includes(token)));
  });
}

export function getParameterSubjectPath(row) {
  return String(row?.kpi_subject || row?.kpi_group || row?.kpi_name || "").trim();
}

export function getParameterSubjectGroupKey(row) {
  const subjectPath = getParameterSubjectPath(row);
  if (subjectPath) return `subject:${subjectPath.toLowerCase()}`;
  return `subject:unassigned:${String(row?.kpi_id || row?.kpi_target_allocation_id || "")}`;
}

export function getParameterSubjectDisplayName(row) {
  const subjectPath = getParameterSubjectPath(row);
  return getLastPathSegment(subjectPath) || subjectPath || "No KPI hierarchy attached";
}

export function groupParameterRowsBySubject(rows) {
  const groupedSubjects = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const subjectKey = getParameterSubjectGroupKey(row);
    if (!groupedSubjects.has(subjectKey)) {
      groupedSubjects.set(subjectKey, {
        key: subjectKey,
        subject_path: getParameterSubjectPath(row),
        subject_name: getParameterSubjectDisplayName(row),
        rows: [],
      });
    }
    groupedSubjects.get(subjectKey).rows.push(row);
  });
  return Array.from(groupedSubjects.values()).map((group) => ({
    ...group,
    allocation_count: group.rows.length,
  }));
}

export function buildParameterScopeSummary(row) {
  const groupedRowCount = Number(
    row.group_row_count || (Array.isArray(row.related_allocations) ? row.related_allocations.length : 0)
  );

  if (groupedRowCount > 1) {
    const scopeNames = Array.isArray(row.group_scope_names) ? row.group_scope_names : [];
    const scopePreview =
      scopeNames.length > 3
        ? `${scopeNames.slice(0, 3).join(", ")} +${scopeNames.length - 3}`
        : scopeNames.join(", ");

    return [
      row.unit_type_name,
      row.role_name,
      scopePreview || `${groupedRowCount} ${getParameterGroupedScopeKindLabel(row, groupedRowCount)}`,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  return [
    row.unit_type_name,
    row.role_name,
    row.plant_name,
    row.zone_name,
    row.unit_name,
    row.function,
    row.product_line_name,
    row.product_name,
    row.market_name,
    row.customer_name,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function getExpectedMultisiteTargetCount(lookups, row = {}) {
  if (String(row.kpi_type || "").trim().toLowerCase() !== "multisite") {
    return Number(row.group_row_count || 1);
  }
  return getParameterAllocationUnits(lookups)
    .filter((unit) => String(unit.unit_type_name || "").trim().toLowerCase() === "factory")
    .filter((unit) => String(unit.label || "").trim().toLowerCase() !== "avocarbon group").length;
}

export function getParameterCategory(row) {
  const parts = splitParameterPath(row.kpi_subject || row.kpi_group || row.kpi_name || "");
  if (parts.length >= 2) return parts[parts.length - 2];
  if (parts.length === 1) return parts[0];
  return "General";
}

// ---------------------------------------------------------------------------
// Allocation id helpers (delete + existing_allocation_ids)
// ---------------------------------------------------------------------------

export function normalizeParameterAllocationIdList(allocationIds = []) {
  return Array.from(
    new Set(
      (Array.isArray(allocationIds) ? allocationIds : [allocationIds])
        .map((allocationId) => String(allocationId || "").trim())
        .filter(Boolean)
    )
  );
}

export function doesParameterRowMatchAllocationIds(row, allocationIds = []) {
  const normalizedAllocationIds = new Set(normalizeParameterAllocationIdList(allocationIds));
  if (!normalizedAllocationIds.size || !row) return false;

  if (normalizedAllocationIds.has(String(row.kpi_target_allocation_id || "").trim())) return true;

  return (
    Array.isArray(row.related_allocations) &&
    row.related_allocations.some((allocationRow) =>
      normalizedAllocationIds.has(String(allocationRow?.kpi_target_allocation_id || "").trim())
    )
  );
}

export function findGroupedParameterRow(rowPools, parameterObjectId) {
  const normalizedParameterObjectId = String(parameterObjectId || "").trim();
  if (!normalizedParameterObjectId) return null;
  return (
    rowPools
      .flat()
      .find((row) => doesParameterRowMatchAllocationIds(row, normalizedParameterObjectId)) || null
  );
}

export function getParameterAllocationIdsForDelete(
  rowPools,
  parameterObjectId,
  { preferFormState = false, unitState = {} } = {}
) {
  if (preferFormState) {
    const stateAllocationIds = normalizeParameterAllocationIdList(
      Object.values(unitState || {}).map((state) => state?.kpi_target_allocation_id)
    );
    if (stateAllocationIds.length) return stateAllocationIds;
  }

  const matchedGroupedRow = findGroupedParameterRow(rowPools, parameterObjectId);
  if (Array.isArray(matchedGroupedRow?.related_allocations) && matchedGroupedRow.related_allocations.length) {
    const relatedIds = normalizeParameterAllocationIdList(
      matchedGroupedRow.related_allocations.map((row) => row?.kpi_target_allocation_id)
    );
    if (relatedIds.length) return relatedIds;
  }

  return normalizeParameterAllocationIdList(parameterObjectId);
}

// inferRoleTargetMode(): a single role row, or several rows sharing one target
// value, means "apply all"; otherwise "individual".
export function inferRoleTargetMode(rows = []) {
  const roleRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => String(row?.kpi_type || "").trim().toLowerCase() === "role"
  );
  if (roleRows.length <= 1) return "individual";
  const targetValues = new Set(roleRows.map((row) => String(row?.target_value ?? "").trim()));
  return targetValues.size === 1 ? "apply_all" : "individual";
}

// fillParameterForm(): map a loaded allocation (+ its related rows) onto the
// parameter form fields.
export function allocationToParameterForm(lookups, data) {
  const relatedAllocations =
    Array.isArray(data?.related_allocations) && data.related_allocations.length
      ? data.related_allocations
      : [data];

  const primaryRow =
    relatedAllocations.find(
      (row) =>
        String(row?.kpi_target_allocation_id || "") === String(data?.kpi_target_allocation_id || "")
    ) ||
    relatedAllocations[0] ||
    data;

  const normalizedKpiType = String(primaryRow?.kpi_type || "").trim().toLowerCase();
  const isGroupedScope =
    normalizedKpiType === "multisite" ||
    normalizedKpiType === "zone" ||
    normalizedKpiType === "product line" ||
    normalizedKpiType === "role";

  const relatedRoleIds = relatedAllocations
    .map((row) => String(row?.role_id || "").trim())
    .filter(Boolean);
  const uniqueRelatedRoleIds = [...new Set(relatedRoleIds)];

  const editRoleId =
    normalizedKpiType === "zone"
      ? uniqueRelatedRoleIds.length === 1
        ? uniqueRelatedRoleIds[0]
        : PARAMETER_ZONE_ALL_ROLE_VALUE
      : primaryRow.role_id ||
        inferParameterRoleIdFromAllocation(lookups, primaryRow, relatedAllocations) ||
        "";

  const form = {
    ...PARAMETER_FORM_DEFAULTS,
    parameter_object_id: primaryRow.kpi_target_allocation_id ?? "",
    parameter_kpi_id: primaryRow.kpi_id ?? "",
    parameter_kpi_type: primaryRow.kpi_type ?? "",
    parameter_unit_type_id: primaryRow.unit_type_id ?? "",
    parameter_role_id: String(editRoleId || ""),
    parameter_role_target_mode:
      primaryRow.role_target_mode ||
      primaryRow.assignment_mode ||
      inferRoleTargetMode(relatedAllocations),
    parameter_target_status: primaryRow.target_status ?? "",
    parameter_plant_id: primaryRow.plant_id ?? "",
    parameter_zone_id: primaryRow.zone_id ?? "",
    parameter_unit_id: primaryRow.unit_id ?? "",
    parameter_function: primaryRow.function ?? "",
    parameter_product_line_id: primaryRow.product_line_id ?? "",
    parameter_product_id: primaryRow.product_id ?? "",
    parameter_market_id: primaryRow.market_id ?? "",
    parameter_customer_id: primaryRow.customer_id ?? "",
    parameter_target_value: primaryRow.target_value ?? "",
    parameter_target_unit: primaryRow.target_unit ?? "",
    parameter_local_currency: primaryRow.local_currency ?? "",
    parameter_last_best_target: primaryRow.last_best_target ?? "",
    parameter_previous_target_value: primaryRow.previous_target_value ?? "",
    parameter_target_setup_date: normalizeParameterDateValue(primaryRow.target_setup_date),
    parameter_target_start_date: normalizeParameterDateValue(primaryRow.target_start_date),
    parameter_target_end_date: normalizeParameterDateValue(primaryRow.target_end_date),
    parameter_set_by_people_id: primaryRow.set_by_people_id ?? "",
    parameter_approved_by_people_id: primaryRow.approved_by_people_id ?? "",
    parameter_comments: primaryRow.comments ?? "",
  };

  // Non-grouped scopes (Individual) stay pinned to their saved unit.
  const lockedUnitId = isGroupedScope
    ? ""
    : String(primaryRow.plant_id || primaryRow.unit_id || "").trim();

  return {
    form,
    relatedAllocations,
    lockedUnitId,
    unitState: initializeParameterUnitTargetState(relatedAllocations),
  };
}

// In edit mode a unit row whose state was not matched by scope key can still be
// recovered from the saved allocations by plant_id / unit_id (original
// renderMultisiteUnitMatrix edit-mode fallback).
export function resolveEditModeUnitState(state, { editMode, editAllocations, scopeKind, scopeId }) {
  if (
    !editMode ||
    scopeKind !== "unit" ||
    !(state.target_value === undefined || state.target_value === null || state.target_value === "")
  ) {
    return state;
  }

  const existingRow = (editAllocations || []).find(
    (row) => String(row?.plant_id || row?.unit_id || "").trim() === scopeId
  );
  if (!existingRow) return state;

  return {
    ...state,
    kpi_target_allocation_id: existingRow.kpi_target_allocation_id ?? "",
    target_value: existingRow.target_value ?? "",
    target_setup_date: normalizeParameterDateValue(existingRow.target_setup_date),
    local_currency: existingRow.local_currency ?? "",
    responsible_id: existingRow.set_by_people_id ?? "",
    set_by_people_id: existingRow.set_by_people_id ?? "",
    last_best_target: existingRow.last_best_target ?? "",
    approved_by_id: existingRow.approved_by_people_id ?? "",
  };
}

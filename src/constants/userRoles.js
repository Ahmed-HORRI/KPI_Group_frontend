// Account roles (same list as the backend, models/auth.model.js). "admin"
// manages the accounts; the others set whose KPIs a user sees in
// "My KPI Analytics" -- the server enforces it.
export const ROLE_META = {
  user: { label: "User", tone: "slate", description: "Sees their own KPI analytics." },
  plant_manager: { label: "Plant Manager", tone: "sky", description: "Also sees the responsibles of their plant." },
  zone_manager: { label: "Zone Manager", tone: "blue", description: "Also sees the plants of their zone." },
  vp: { label: "VP", tone: "navy", description: "Sees the KPI analytics of every responsible." },
  ceo: { label: "CEO", tone: "brand", description: "Sees the KPI analytics of every responsible." },
  admin: { label: "Administrator", tone: "orange", description: "Manages the accounts and sees every KPI." },
};

export const ROLE_OPTIONS = Object.entries(ROLE_META).map(([value, meta]) => ({ value, label: meta.label }));

export const getRoleMeta = (role) => ROLE_META[role] || { label: role || "-", tone: "slate", description: "" };

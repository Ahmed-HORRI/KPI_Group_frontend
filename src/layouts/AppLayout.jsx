import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getHomePath } from "../auth/RouteGuards";
import Avatar from "../components/Avatar.jsx";
import BrandLogo from "../components/BrandLogo.jsx";
import DropdownMenu from "../components/DropdownMenu.jsx";
import {
  ChevronDownIcon,
  ClipboardIcon,
  DashboardIcon,
  KeyIcon,
  LogoutIcon,
  MoonIcon,
  ShieldIcon,
  SunIcon,
} from "../components/icons.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import { getRoleMeta } from "../constants/userRoles";

function UserMenu() {
  const { user, isAdmin, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const displayName = user?.full_name || user?.email || "";

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <DropdownMenu
      label={`Account menu for ${displayName}`}
      width={300}
      renderTrigger={({ ref, open, props }) => (
        <button
          ref={ref}
          type="button"
          {...props}
          className={`flex items-center gap-2.5 rounded-full border bg-white py-1 pl-1 pr-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:bg-slate-800 dark:text-slate-200 dark:shadow-none dark:hover:bg-slate-700 dark:focus-visible:ring-blue-500/20 ${
            open
              ? "border-blue-200 ring-4 ring-blue-50 dark:border-blue-500/40 dark:ring-blue-500/15"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <Avatar name={displayName} seed={user?.email} size="sm" />
          <span className="hidden max-w-[180px] truncate sm:inline">{displayName}</span>
          <ChevronDownIcon size={16} className={`text-slate-400 transition dark:text-slate-500 ${open ? "rotate-180" : ""}`} />
        </button>
      )}
      header={
        <div className="flex items-center gap-3">
          <Avatar name={displayName} seed={user?.email} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{user?.full_name}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
            <span
              className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isAdmin
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
                  : "bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {isAdmin ? <ShieldIcon size={11} /> : null}
              {getRoleMeta(user?.role).label}
            </span>
          </div>
        </div>
      }
      sections={[
        {
          key: "navigation",
          items: [
            user?.people_id
              ? {
                  key: "dashboard",
                  label: "My KPI dashboard",
                  description: "Your KPIs and target allocations",
                  icon: DashboardIcon,
                  tone: "brand",
                  to: `/responsible/${user.people_id}/dashboard`,
                }
              : null,
            {
              key: "intake",
              label: "KPI & Target Intake",
              description: "Enter new KPIs and target allocations",
              icon: ClipboardIcon,
              to: "/kpi-intake",
            },
            isAdmin
              ? {
                  key: "admin",
                  label: "User administration",
                  description: "Accounts, roles and access",
                  icon: ShieldIcon,
                  to: "/admin/users",
                }
              : null,
            {
              key: "password",
              label: "Change password",
              description: "Signs out your other devices",
              icon: KeyIcon,
              to: "/change-password",
            },
          ],
        },
        {
          key: "appearance",
          items: [
            {
              key: "theme",
              label: darkMode ? "Light mode" : "Dark mode",
              description: darkMode ? "Switch back to the light theme" : "Easier on the eyes in low light",
              icon: darkMode ? SunIcon : MoonIcon,
              onSelect: toggleDarkMode,
            },
          ],
        },
        {
          key: "session",
          items: [{ key: "logout", label: "Log out", icon: LogoutIcon, tone: "danger", onSelect: signOut }],
        },
      ]}
    />
  );
}

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
    isActive
      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
  }`;

// Layout of the pages that require a session: a slim top bar with the
// signed-in user, above the page itself.
export default function AppLayout() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Stays at the top while the page scrolls (h-14). z-30: under dialogs and dropdowns.
          The brand bar sits inside those 56px, over the bottom edge, so the
          sticky elements placed under the header (top-14) still line up. */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-950">
        <span className="brand-bar pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" aria-hidden="true" />
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to={getHomePath(user)} className="flex items-center" aria-label="KPI Manager home">
              <span className="sm:hidden">
                <BrandLogo className="h-6" />
              </span>
              <span className="hidden sm:inline-flex">
                <BrandLogo className="h-7" product />
              </span>
            </Link>
            <nav className="ml-2 hidden items-center gap-1 sm:flex">
              {user?.people_id ? (
                <NavLink to={`/responsible/${user.people_id}/dashboard`} className={navLinkClass}>
                  My KPI dashboard
                </NavLink>
              ) : null}
              <NavLink to="/kpi-intake" className={navLinkClass}>
                KPI intake
              </NavLink>
              {isAdmin ? (
                <NavLink to="/admin/users" className={navLinkClass}>
                  Administration
                </NavLink>
              ) : null}
            </nav>
          </div>
          <UserMenu />
        </div>
      </header>
      <Outlet />
    </div>
  );
}

import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";

function FullPageMessage({ title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-slate-950">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <h1 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h1>
        {children ? <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{children}</div> : null}
      </div>
    </div>
  );
}

// Signed-in users only; anyone else goes to /login and comes back afterwards.
// A user on a temporary password is sent to /change-password first.
export function RequireAuth() {
  const { user, status, refresh } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageMessage title="Loading..." />;
  if (status === "error") {
    return (
      <FullPageMessage title="Unable to reach the server">
        <button type="button" onClick={refresh} className="mt-3 font-bold text-[#0078D7] hover:underline">
          Try again
        </button>
      </FullPageMessage>
    );
  }
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <FullPageMessage title="Administrator access required">
        This page is only available to administrators.{" "}
        <Link to={getHomePath(user)} className="font-bold text-[#0078D7] hover:underline">
          Back to my dashboard
        </Link>
      </FullPageMessage>
    );
  }
  return <Outlet />;
}

// The Responsible KPI Dashboard of a user is the one of their person
// (/responsible/<their people_id>/dashboard); another id sends them back to
// their own. Administrators can open anyone's. The API enforces the same rule.
export function RequireOwnDashboard() {
  const { user, isAdmin } = useAuth();
  const { responsibleId } = useParams();

  if (isAdmin || String(user?.people_id ?? "") === String(responsibleId)) return <Outlet />;
  if (user?.people_id) return <Navigate to={`/responsible/${user.people_id}/dashboard`} replace />;
  return (
    <FullPageMessage title="No KPI dashboard for this account">
      Your account is not linked to a person yet. Ask your KPI Manager administrator to link it.
    </FullPageMessage>
  );
}

// Where a signed-in user lands by default: their own Responsible KPI Dashboard
// when the account is linked to a person (the dashboard id is the people_id).
export function getHomePath(user) {
  if (user?.people_id) return `/responsible/${user.people_id}/dashboard`;
  if (user?.role === "admin") return "/admin/users";
  return "/dashboard";
}

// Only allows paths inside the app as a post-login destination (no open
// redirect); null when there is no usable destination.
export function getSafeNextPath(next) {
  const value = String(next || "");
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}

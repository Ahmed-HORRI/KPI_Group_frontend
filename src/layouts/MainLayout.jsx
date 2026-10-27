import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getHomePath } from "../auth/RouteGuards";
import BrandLogo from "../components/BrandLogo.jsx";
import { ArrowLeftIcon, ShieldIcon } from "../components/icons.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

// Layout of the open pages (most are reached from an e-mail link): the
// AVOCarbon header with its brand bar and the light / dark switch, above the
// page itself. A signed-in visitor also finds the way back to their dashboard
// and, for an administrator, the role there. It scrolls away, so the pages'
// own sticky headers keep the top of the screen.
export default function MainLayout() {
  const { user, isAdmin } = useAuth();
  const signedIn = Boolean(user) && !user.must_change_password;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="relative bg-white dark:bg-slate-950 print:hidden">
        <span className="brand-bar pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" aria-hidden="true" />
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <BrandLogo className="h-7" product />
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link
                to={getHomePath(user)}
                className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 sm:inline-flex dark:text-blue-400 dark:hover:bg-blue-500/10"
              >
                <ArrowLeftIcon size={15} /> {user.people_id ? "My KPI dashboard" : "Administration"}
              </Link>
            ) : null}
            {signedIn && isAdmin ? (
              <span className="hidden h-9 items-center gap-1.5 rounded-xl bg-orange-50 px-3 text-xs font-bold text-orange-700 ring-1 ring-inset ring-orange-600/15 md:inline-flex dark:bg-orange-500/10 dark:text-orange-300">
                <ShieldIcon size={14} /> Administrator · {user.full_name || user.email}
              </span>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

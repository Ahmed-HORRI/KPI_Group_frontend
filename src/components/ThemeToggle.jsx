import { MoonIcon, SunIcon } from "./icons.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";

// Round light / dark switch of the pages without the account menu (open
// pages and sign-in screens); the signed-in pages have it in that menu.
export default function ThemeToggle({ className = "" }) {
  const { darkMode, toggleDarkMode } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={darkMode ? "Light mode" : "Dark mode"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:ring-blue-500/20 ${className}`}
    >
      {darkMode ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}

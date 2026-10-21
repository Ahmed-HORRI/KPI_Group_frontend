import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

// Historical name (the toggle started on the Responsible dashboard), kept so
// the choice users already saved still applies.
const STORAGE_KEY = "responsible-dashboard-theme";

const ThemeContext = createContext(null);

function readStoredDarkMode() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}

// Light / dark theme of the signed-in pages (dashboard, administration,
// password change), one choice shared by all of them.
export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(readStoredDarkMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, darkMode ? "dark" : "light");
    } catch {
      // localStorage unavailable -- theme just won't persist across reloads.
    }
  }, [darkMode]);

  // On <html> rather than a page wrapper so dialogs and menus, rendered in
  // portals on <body>, follow it too. Removed when the signed-in area is left:
  // the open pages and sign-in screens have no dark styles.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    return () => root.classList.remove("dark");
  }, [darkMode]);

  const value = useMemo(
    () => ({ darkMode, setDarkMode, toggleDarkMode: () => setDarkMode((current) => !current) }),
    [darkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return context;
}

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

// Historical name (the toggle started on the Responsible dashboard), kept so
// the choice users already saved still applies. index.html reads it too.
const STORAGE_KEY = "responsible-dashboard-theme";

const ThemeContext = createContext(null);

function readStoredDarkMode() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}

// Light / dark theme of the whole application (signed-in pages, the open
// pages reached from e-mails and the sign-in screens): one choice, kept in
// this browser.
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
  // portals on <body>, follow it too. Printing always uses the light theme.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    if (!darkMode) return undefined;
    const beforePrint = () => root.classList.remove("dark");
    const afterPrint = () => root.classList.add("dark");
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
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

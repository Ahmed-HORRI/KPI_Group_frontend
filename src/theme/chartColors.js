import { useTheme } from "./ThemeContext.jsx";

// Colors of the Chart.js charts, which draw on a canvas and so cannot use the
// dark: classes. KPI trends follow one scheme: status-colored value marks
// (good / critical) on a neutral value line, the target in AVO blue, both
// limits dashed in GROUP orange. Dark values are stepped for the navy cards
// (slate-900, #1a364e): every mark keeps at least 3:1 against them, so the
// critical red is lighter there.
export const CHART_COLORS = {
  light: {
    text: "#737373", // ticks
    legend: "#585858",
    title: "#171717", // axis titles
    grid: "rgba(161,161,161,0.2)",
    surface: "#ffffff", // ring around points, gap between doughnut segments
    value: "#585858", // "Carbon" gray
    missing: "#a1a1a1",
    target: "#076eaf",
    limit: "#ef7904",
    good: "#0ca30c",
    critical: "#d03b3b",
  },
  dark: {
    text: "#a4b4c3",
    legend: "#c5d1dc",
    title: "#dde4eb",
    grid: "rgba(164,180,195,0.14)",
    surface: "#1a364e",
    value: "#8295a6",
    missing: "#5e7489",
    target: "#3487c7",
    limit: "#d56b03",
    good: "#0ca30c",
    critical: "#e66767",
  },
};

export function useChartColors() {
  const { darkMode } = useTheme();
  return darkMode ? CHART_COLORS.dark : CHART_COLORS.light;
}

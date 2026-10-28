// Shades of AVO blue, as the icon tiles of the board titles: each one dark
// enough for white initials (blue-600 and darker). No orange (dark enough for
// white text it turns brown) and no gray. On the navy dark theme the darkest
// shades step up to blue-600 so the avatar stays visible.
const AVATAR_TONES = [
  "bg-gradient-to-br from-blue-600 to-blue-700 text-white",
  "bg-gradient-to-br from-blue-600 to-blue-800 text-white",
  "bg-gradient-to-br from-blue-700 to-blue-900 text-white dark:from-blue-600 dark:to-blue-800",
  "bg-gradient-to-br from-blue-800 to-blue-950 text-white dark:from-blue-600 dark:to-blue-700",
];

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function getInitials(name, fallback = "?") {
  const parts = String(name || "").trim().split(/[\s@._-]+/).filter(Boolean);
  if (!parts.length) return fallback;
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Same person -> same color, everywhere in the app.
function getTone(seed) {
  let hash = 0;
  for (const char of String(seed || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export default function Avatar({ name, seed, size = "md", className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide dark:ring-1 dark:ring-inset dark:ring-white/15 ${SIZES[size] || SIZES.md} ${getTone(seed || name)} ${className}`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

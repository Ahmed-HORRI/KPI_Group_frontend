// Brand colors only (AVO blue, GROUP orange, Carbon gray), each dark enough
// for white initials.
const AVATAR_TONES = [
  "bg-blue-600 text-white",
  "bg-orange-700 text-white",
  "bg-slate-600 text-white",
  "bg-blue-800 text-white",
  "bg-blue-950 text-white",
  "bg-orange-800 text-white",
  "bg-blue-700 text-white",
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide ${SIZES[size] || SIZES.md} ${getTone(seed || name)} ${className}`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

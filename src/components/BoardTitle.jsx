// Icon tile colors: AVO blue, or a status color when the screen reports one.
const TILE_TONES = {
  brand: "bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-600/25 dark:shadow-black/30",
  success: "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-600/25 dark:shadow-black/30",
  danger: "bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-600/25 dark:shadow-black/30",
};

// Title of every board, the same everywhere: an AVO-blue icon tile, a small
// eyebrow, the title and the brand accent under it (AVO blue ending in GROUP
// orange, as under the logo). `inverse` for a title on a blue hero banner;
// `tone` (success / danger) for a screen that reports an outcome.
export default function BoardTitle({ icon: Icon, eyebrow, title, subtitle, inverse = false, tone = "brand", className = "" }) {
  return (
    <div className={`flex min-w-0 items-start gap-4 ${className}`}>
      {Icon ? (
        <span
          className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${
            inverse ? "bg-white/15 ring-1 ring-inset ring-white/25" : TILE_TONES[tone] || TILE_TONES.brand
          }`}
          aria-hidden="true"
        >
          <Icon size={24} />
        </span>
      ) : null}
      <div className="min-w-0">
        {eyebrow ? (
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
              inverse ? "text-blue-100" : "text-blue-600 dark:text-blue-300"
            }`}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={`mt-1 text-[28px] font-black leading-tight tracking-tight sm:text-[32px] ${
            inverse ? "text-white" : "text-slate-900 dark:text-white"
          }`}
        >
          {title}
        </h1>
        <span className="mt-3 flex h-1 w-16 overflow-hidden rounded-full" aria-hidden="true">
          <span className={`w-3/4 ${inverse ? "bg-white" : "bg-blue-600 dark:bg-blue-400"}`} />
          <span className="flex-1 bg-orange-500" />
        </span>
        {subtitle ? (
          <div
            className={`mt-3 max-w-3xl text-sm leading-6 ${
              inverse ? "text-white/85" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

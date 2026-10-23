import { useEffect, useState } from "react";
import { Spinner } from "../../../components/Dialog.jsx";
import {
  AlertIcon,
  ArrowRightIcon,
  ChartIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  LockIcon,
  MailIcon,
  TargetIcon,
} from "../../../components/icons.jsx";

// Same rules as the backend (src/utils/password.js); the server stays the
// authority, this list only gives live feedback while typing.
export function getPasswordChecks(password, email = "") {
  const value = String(password || "");
  const emailName = String(email || "").split("@")[0].trim().toLowerCase();
  const checks = [
    { label: "At least 10 characters", ok: value.length >= 10 && value.length <= 128 },
    { label: "A lowercase letter", ok: /[a-z]/.test(value) },
    { label: "An uppercase letter", ok: /[A-Z]/.test(value) },
    { label: "A digit", ok: /[0-9]/.test(value) },
  ];
  if (emailName.length >= 4) {
    checks.push({ label: "Does not contain your e-mail name", ok: !value.toLowerCase().includes(emailName) });
  }
  return checks;
}

export function isPasswordAcceptable(password, email) {
  return getPasswordChecks(password, email).every((check) => check.ok);
}

// Random 16-character password meeting the rules (no look-alike characters).
export function generateStrongPassword(length = 16) {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!#$%*+-=?@"];
  const all = groups.join("");
  const random = (max) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  };
  const chars = groups.map((group) => group[random(group.length)]);
  while (chars.length < length) chars.push(all[random(all.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = random(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
}

// 0-4: rules met, plus length and symbols beyond the minimum.
function getPasswordStrength(password, email) {
  const value = String(password || "");
  if (!value) return 0;
  if (!isPasswordAcceptable(value, email)) return value.length >= 6 ? 1 : 0;
  let score = 2;
  if (value.length >= 14) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

export const authInputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0078D7] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-500 dark:focus:ring-blue-500/20 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500 dark:[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#1e293b] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#f1f5f9]";

export const primaryButtonClass =
  "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl btn-brand px-4 text-[15px] font-bold shadow-lg shadow-blue-500/20 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 active:translate-y-px dark:shadow-none dark:focus-visible:ring-blue-500/30";

export const secondaryButtonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200";

export function SubmitButton({ loading, loadingLabel, children, disabled, type = "submit", onClick }) {
  return (
    <button type={type} className={primaryButtonClass} disabled={disabled || loading} onClick={onClick}>
      {loading ? <Spinner /> : null}
      {loading ? loadingLabel || children : children}
      {!loading ? <ArrowRightIcon size={18} className="transition group-hover:translate-x-0.5" /> : null}
    </button>
  );
}

const BRAND_FEATURES = [
  { icon: ChartIcon, title: "Track every KPI", text: "Weekly and monthly results against targets and limits." },
  { icon: GlobeIcon, title: "Steer all sites", text: "Allocate targets by plant, zone, role or product line." },
  { icon: TargetIcon, title: "Act on deviations", text: "Corrective actions follow every KPI out of target." },
];

// Left half of the sign-in screens (large screens only).
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#06294d] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a3d73] via-[#0063b8] to-[#0a8fe8]" />
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-indigo-500/30 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="auth-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M36 0H0V36" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="inline-flex rounded-2xl bg-white px-4 py-2.5 shadow-lg shadow-black/20">
          <img src="/avocarbon-logo.png" alt="AVOCarbon Group" className="h-7 w-auto" />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100/80">KPI Manager</span>
      </div>

      <div className="relative max-w-lg">
        <h2 className="text-4xl font-black leading-[1.1] tracking-tight xl:text-[44px]">
          Every KPI,
          <br />
          one clear view.
        </h2>
        <p className="mt-4 text-base leading-7 text-blue-100/85">
          Follow your indicators, set targets across the group and act on deviations, all in one workspace.
        </p>

        <ul className="mt-9 flex flex-col gap-5">
          {BRAND_FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20 backdrop-blur">
                <Icon size={19} />
              </span>
              <span>
                <span className="block text-[15px] font-bold">{title}</span>
                <span className="block text-sm leading-6 text-blue-100/75">{text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-10 max-w-sm rounded-2xl bg-white/10 p-5 shadow-2xl shadow-black/20 ring-1 ring-white/20 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-100/70">Scrap rate · Week 42</div>
              <div className="mt-1 text-3xl font-black tabular-nums">
                2.4<span className="text-lg font-bold text-blue-100/80"> %</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/30">
              <CheckCircleIcon size={13} /> On target
            </span>
          </div>
          <svg viewBox="0 0 280 64" className="mt-3 h-14 w-full" aria-hidden="true">
            <defs>
              <linearGradient id="auth-spark" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" x2="280" y1="22" y2="22" stroke="#a7f3d0" strokeOpacity="0.6" strokeDasharray="4 5" />
            <path d="M0 18 L35 26 L70 21 L105 34 L140 30 L175 40 L210 37 L245 46 L280 43 L280 64 L0 64 Z" fill="url(#auth-spark)" />
            <path
              d="M0 18 L35 26 L70 21 L105 34 L140 30 L175 40 L210 37 L245 46 L280 43"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="280" cy="43" r="4" fill="#fff" />
          </svg>
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-blue-100/60">
            <span>Target 3.0 %</span>
            <span>-0.6 pt vs last month</span>
          </div>
        </div>
      </div>

      <div className="relative text-xs text-blue-100/60">
        © {new Date().getFullYear()} AVOCarbon Group · Internal application
      </div>
    </aside>
  );
}

// Light, raised tile over a soft glow of the same color (Fluent-style depth).
const AUTH_ICON_TONES = {
  brand: { tile: "from-white to-[#dcebfb] text-[#0078D7] ring-[#0078D7]/20", glow: "bg-[#0078D7]/40" },
  success: { tile: "from-white to-emerald-100 text-emerald-600 ring-emerald-600/20", glow: "bg-emerald-500/40" },
  danger: { tile: "from-white to-red-100 text-red-600 ring-red-600/20", glow: "bg-red-500/40" },
};

// Full-page layout of the sign-in screens: brand panel + form.
export function AuthCard({ icon: Icon, iconTone = "brand", title, subtitle, children, footer }) {
  const tone = AUTH_ICON_TONES[iconTone] || AUTH_ICON_TONES.brand;
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />
      <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-slate-50/80 to-white px-5 py-8 sm:px-10 lg:bg-none lg:bg-white">
        <div className="flex items-center justify-between lg:hidden">
          <img src="/avocarbon-logo.png" alt="AVOCarbon Group" className="h-8 w-auto" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">KPI Manager</span>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10 animate-kpi-dialog">
          {Icon ? (
            <div className="relative mb-7 h-12 w-12">
              <span className={`absolute inset-x-2 top-4 -bottom-1.5 rounded-2xl blur-md ${tone.glow}`} aria-hidden="true" />
              <span
                className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ring-1 ${tone.tile}`}
              >
                <Icon size={22} />
              </span>
            </div>
          ) : null}
          <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-[15px] leading-6 text-slate-500">{subtitle}</p> : null}
          {/* Without a subtitle the body text plays that role: keep it close to the title. */}
          {children ? <div className={subtitle ? "mt-8" : "mt-5"}>{children}</div> : null}
          {footer ? <div className="mt-8 text-sm text-slate-500">{footer}</div> : null}
        </div>

        <div className="mx-auto w-full max-w-[400px] border-t border-slate-100 pt-5 text-xs leading-5 text-slate-400">
          Need an account or access? Contact your KPI Manager administrator.
        </div>
      </main>
    </div>
  );
}

const ALERT_TONES = {
  error: {
    box: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
    icon: AlertIcon,
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    icon: CheckCircleIcon,
  },
  info: {
    box: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
    icon: AlertIcon,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    icon: AlertIcon,
  },
};

export function FormAlert({ tone = "error", children }) {
  if (!children) return null;
  const { box, icon: Icon } = ALERT_TONES[tone] || ALERT_TONES.error;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-5 animate-kpi-pop ${box}`}
    >
      <Icon size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function InputShell({ icon: Icon, children }) {
  return (
    <div className="relative">
      {Icon ? (
        <Icon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      ) : null}
      {children}
    </div>
  );
}

export function TextField({ label, id, icon = MailIcon, ...inputProps }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <InputShell icon={icon}>
        <input id={id} className={`${authInputClass} ${icon ? "pl-11" : ""}`} {...inputProps} />
      </InputShell>
    </label>
  );
}

// revealSignal: bump it to show the value (e.g. right after generating it).
export function PasswordField({ label, id, value, onChange, autoComplete, autoFocus, disabled, revealSignal = 0, action }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  useEffect(() => {
    if (revealSignal) setVisible(true);
  }, [revealSignal]);

  const detectCapsLock = (event) => setCapsLock(Boolean(event.getModifierState?.("CapsLock")));

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {action}
      </div>
      <InputShell icon={LockIcon}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`${authInputClass} pl-11 pr-12`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={detectCapsLock}
          onKeyUp={detectCapsLock}
          onBlur={() => setCapsLock(false)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          spellCheck={false}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 dark:focus-visible:ring-blue-500/30"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </InputShell>
      {capsLock ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <AlertIcon size={14} /> Caps Lock is on
        </span>
      ) : null}
    </div>
  );
}

const STRENGTH_LEVELS = [
  { label: "Too weak", bar: "bg-slate-200 dark:bg-slate-700", text: "text-slate-400 dark:text-slate-500" },
  { label: "Too weak", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  { label: "Good", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { label: "Very strong", bar: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300" },
];

export function PasswordChecklist({ password, email }) {
  const strength = getPasswordStrength(password, email);
  const level = STRENGTH_LEVELS[strength];
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors ${strength >= step ? level.bar : "bg-slate-200 dark:bg-slate-700"}`}
            />
          ))}
        </div>
        <span className={`w-20 text-right text-xs font-bold ${password ? level.text : "text-slate-400 dark:text-slate-500"}`}>
          {password ? level.label : "Strength"}
        </span>
      </div>
      <ul className="mt-2.5 grid grid-cols-1 gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
        {getPasswordChecks(password, email).map((check) => (
          <li
            key={check.label}
            className={`flex items-center gap-1.5 transition-colors ${check.ok ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}
          >
            {check.ok ? (
              <CheckCircleIcon size={14} className="shrink-0" />
            ) : (
              <span className="ml-[3px] mr-[3px] h-2 w-2 shrink-0 rounded-full border-[1.5px] border-slate-300 dark:border-slate-600" aria-hidden="true" />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Body of a state screen (e-mail sent, invalid link) inside AuthCard.
export function AuthStatus({ children }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

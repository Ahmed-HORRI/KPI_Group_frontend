import { useState } from "react";
import { CheckCircleIcon, CopyIcon, SparklesIcon } from "../../../components/icons.jsx";
import { PasswordChecklist, PasswordField, generateStrongPassword } from "../../Auth/components/authUi";

// The person's id in public.people -- also the id of their KPI dashboard
// (/responsible/<id>/dashboard).
export function PeopleIdBadge({ peopleId }) {
  return (
    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
      ID {peopleId}
    </span>
  );
}

export function FormSection({ title, hint, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{title}</h3>
        {hint ? <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ label, required, hint, htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="flex items-baseline gap-2">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {label}
          {required ? <span className="text-red-500 dark:text-red-400"> *</span> : null}
        </span>
        {hint ? <span className="truncate text-xs font-normal text-slate-400 dark:text-slate-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

// Radio choice rendered as a selectable card.
export function ChoiceCard({ name, value, checked, onChange, icon: Icon, title, description, disabled, tone = "brand" }) {
  const checkedTone =
    tone === "violet"
      ? "border-violet-300 bg-violet-50/60 ring-4 ring-violet-100 dark:border-violet-500/50 dark:bg-violet-500/10 dark:ring-violet-500/15"
      : "border-blue-300 bg-blue-50/60 ring-4 ring-blue-100 dark:border-blue-500/50 dark:bg-blue-500/10 dark:ring-blue-500/15";
  const iconTone = checked
    ? tone === "violet"
      ? "bg-violet-600 text-white"
      : "bg-[#0078D7] text-white"
    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  return (
    <label
      className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
        checked
          ? checkedTone
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="peer sr-only"
      />
      {Icon ? (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${iconTone}`}>
          <Icon size={18} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-800 dark:text-white">{title}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span> : null}
      </span>
      <span
        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 ${
          checked
            ? tone === "violet"
              ? "border-violet-600 dark:border-violet-400"
              : "border-[#0078D7] dark:border-blue-400"
            : "border-slate-300 dark:border-slate-600"
        }`}
        aria-hidden="true"
      >
        {checked ? (
          <span
            className={`h-1.5 w-1.5 rounded-full ${tone === "violet" ? "bg-violet-600 dark:bg-violet-400" : "bg-[#0078D7] dark:bg-blue-400"}`}
          />
        ) : null}
      </span>
    </label>
  );
}

export function ToggleRow({ checked, onChange, title, description, disabled }) {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800/40 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-800 dark:text-white">{title}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 ${
          checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </label>
  );
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return [copied, copy];
}

// Temporary password input with "Generate" and "Copy" helpers.
export function TemporaryPasswordInput({ id, value, onChange, email, autoFocus }) {
  const [revealSignal, setRevealSignal] = useState(0);
  const [copied, copy] = useCopy();
  const smallButton =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";

  return (
    <div className="flex flex-col gap-3">
      <PasswordField
        label="Temporary password"
        id={id}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
        autoFocus={autoFocus}
        revealSignal={revealSignal}
      />
      <div className="-mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          className={smallButton}
          onClick={() => {
            onChange(generateStrongPassword());
            setRevealSignal((count) => count + 1);
          }}
        >
          <SparklesIcon size={14} /> Generate a strong password
        </button>
        <button type="button" className={smallButton} onClick={() => copy(value)} disabled={!value}>
          {copied ? <CheckCircleIcon size={14} className="text-emerald-600 dark:text-emerald-400" /> : <CopyIcon size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <PasswordChecklist password={value} email={email} />
    </div>
  );
}

import { useState } from "react";
import apiClient, { getApiErrorMessage } from "../../../api/client";
import Avatar from "../../../components/Avatar.jsx";
import Dialog, { Spinner, buttonClasses } from "../../../components/Dialog.jsx";
import { AlertIcon, CheckCircleIcon, CopyIcon, KeyIcon, LinkIcon } from "../../../components/icons.jsx";
import { isPasswordAcceptable } from "../../Auth/components/authUi";
import { TemporaryPasswordInput, useCopy } from "./formUi";

function UserChip({ user }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <Avatar name={user.full_name || user.email} seed={user.email} size="md" />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-800 dark:text-white">{user.full_name}</div>
        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
      </div>
    </div>
  );
}

export function TemporaryPasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canSave = !saving && isPasswordAcceptable(password, user.email);

  const save = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiClient.post(`/api/admin/users/${user.user_id}/temporary-password`, { password });
      onSaved({
        user: res.data.user,
        message: `Temporary password set for ${user.email}. They are signed out and must choose a new password at their next sign-in.`,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to set the temporary password."));
      setSaving(false);
    }
  };

  return (
    <Dialog
      icon={KeyIcon}
      tone="warning"
      title="Set a temporary password"
      subtitle="The user is signed out everywhere and must replace it at the next sign-in."
      busy={saving}
      onClose={onClose}
      footerHint="Share it by phone or in person, never by e-mail."
      footer={
        <>
          <button type="button" className={buttonClasses.secondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="temporary-password-form" className={buttonClasses.primary} disabled={!canSave}>
            {saving ? <Spinner /> : null}
            Set the password
          </button>
        </>
      }
    >
      <form id="temporary-password-form" onSubmit={save} className="flex flex-col gap-4" noValidate>
        <UserChip user={user} />
        {error ? (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertIcon size={18} className="mt-px shrink-0" />
            {error}
          </div>
        ) : null}
        <TemporaryPasswordInput
          id="admin-temporary-password"
          value={password}
          onChange={setPassword}
          email={user.email}
          autoFocus
        />
      </form>
    </Dialog>
  );
}

// Shown when an invitation / reset e-mail could not be sent.
export function ManualLinkModal({ email, link, onClose }) {
  const [copied, copy] = useCopy();

  return (
    <Dialog
      icon={LinkIcon}
      tone="warning"
      title="The e-mail could not be sent"
      subtitle={`The account is ready, but the e-mail to ${email} did not leave. Pass the link on yourself.`}
      onClose={onClose}
      footer={
        <button type="button" className={buttonClasses.primary} onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={link}
            onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
            aria-label="Password link"
          />
          <button
            type="button"
            onClick={() => copy(link)}
            data-autofocus
            className={`${buttonClasses.secondary} shrink-0 ${copied ? "border-emerald-200 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300" : ""}`}
          >
            {copied ? <CheckCircleIcon size={16} /> : <CopyIcon size={16} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertIcon size={18} className="mt-px shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Anyone with this link can set the password of the account, once. Send it only to {email}, through a channel you
            trust (Teams chat, phone).
          </span>
        </div>
      </div>
    </Dialog>
  );
}

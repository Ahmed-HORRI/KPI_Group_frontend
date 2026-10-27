import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { getHomePath } from "../../auth/RouteGuards";
import BoardTitle from "../../components/BoardTitle.jsx";
import { KeyIcon } from "../../components/icons.jsx";
import {
  FormAlert,
  PasswordChecklist,
  PasswordField,
  isPasswordAcceptable,
  primaryButtonClass,
} from "./components/authUi";

export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const forced = Boolean(user?.must_change_password);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const passwordsMatch = newPassword === confirmation;
  const canSubmit =
    Boolean(currentPassword) && isPasswordAcceptable(newPassword, user?.email) && passwordsMatch && !submitting;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setDone(true);
      if (forced) navigate(getHomePath(user), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to change the password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <BoardTitle
          icon={KeyIcon}
          eyebrow="KPI Manager account"
          title="Change password"
          subtitle={
            forced
              ? "Your administrator gave you a temporary password. Choose your own password to continue."
              : "Your other signed-in devices will be signed out."
          }
        />

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          {done ? <FormAlert tone="success">Your password has been changed.</FormAlert> : null}
          <FormAlert>{error}</FormAlert>
          <input type="email" value={user?.email || ""} autoComplete="username" readOnly hidden />
          <PasswordField
            label={forced ? "Temporary password" : "Current password"}
            id="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            autoFocus
          />
          <PasswordField
            label="New password"
            id="new-password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordChecklist password={newPassword} email={user?.email} />
          <PasswordField
            label="Confirm the new password"
            id="new-password-confirmation"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          {confirmation && !passwordsMatch ? (
            <div className="-mt-2 text-xs font-semibold text-red-600 dark:text-red-400">The two passwords do not match.</div>
          ) : null}
          <button type="submit" className={primaryButtonClass} disabled={!canSubmit}>
            {submitting ? "Saving..." : "Change password"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          {forced ? (
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="font-semibold text-slate-500 hover:underline dark:text-slate-400"
            >
              Log out
            </button>
          ) : (
            <Link to={getHomePath(user)} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Back to my dashboard
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import apiClient, { getApiErrorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import Avatar from "../../components/Avatar.jsx";
import { Spinner } from "../../components/Dialog.jsx";
import { AlertIcon, ArrowLeftIcon, KeyIcon, ShieldIcon } from "../../components/icons.jsx";
import {
  AuthCard,
  AuthStatus,
  FormAlert,
  PasswordChecklist,
  PasswordField,
  SubmitButton,
  isPasswordAcceptable,
  primaryButtonClass,
} from "./components/authUi";

const backToSignIn = (
  <Link
    to="/login"
    className="inline-flex items-center gap-1.5 font-semibold text-slate-600 transition hover:text-[#0078D7]"
  >
    <ArrowLeftIcon size={16} /> Back to sign in
  </Link>
);

// Target of both the reset e-mail and the invitation e-mail
// (/reset-password?token=...[&mode=invite]).
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [token] = useState(() => searchParams.get("token") || "");

  const [link, setLink] = useState({ status: token ? "checking" : "invalid", email: "", purpose: "", fullName: "" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Keep the single-use token out of the address bar and the browser history.
  useEffect(() => {
    if (searchParams.get("token")) window.history.replaceState(null, "", "/reset-password");
  }, [searchParams]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    apiClient
      .get("/api/auth/password-token", { params: { token } })
      .then((res) => {
        if (cancelled) return;
        setLink({ status: "valid", email: res.data.email, purpose: res.data.purpose, fullName: res.data.full_name });
      })
      .catch((err) => {
        if (!cancelled) setLink({ status: "invalid", message: getApiErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isInvite = link.purpose === "invite";
  const passwordsMatch = password === confirmation;
  const canSubmit = isPasswordAcceptable(password, link.email) && passwordsMatch && Boolean(confirmation);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/api/auth/reset-password", { token, password });
      await refresh();
      navigate("/login", {
        replace: true,
        state: {
          email: link.email,
          notice: isInvite
            ? "Your account is active. Sign in with your new password."
            : "Your password has been changed. Sign in with your new password.",
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to save the password."));
      setSubmitting(false);
    }
  };

  if (link.status === "checking") {
    return (
      <AuthCard title="Checking your link...">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> One moment, we are verifying your link.
        </div>
      </AuthCard>
    );
  }

  if (link.status === "invalid") {
    return (
      <AuthCard icon={AlertIcon} iconTone="danger" title="This link can no longer be used" footer={backToSignIn}>
        <AuthStatus>
          <p className="text-[15px] leading-6 text-slate-600">
            {link.message || "This link is invalid or has expired."} Links work once, for a limited time: a reset link for
            60 minutes, an invitation for 72 hours.
          </p>
          <Link to="/forgot-password" className={primaryButtonClass}>
            Request a new link
          </Link>
          <p className="text-sm text-slate-500">Invitation expired? Ask your administrator to send you a new one.</p>
        </AuthStatus>
      </AuthCard>
    );
  }

  const firstName = String(link.fullName || "").trim().split(/\s+/)[0];

  return (
    <AuthCard
      icon={isInvite ? ShieldIcon : KeyIcon}
      title={isInvite ? "Activate your account" : "Choose a new password"}
      subtitle={
        isInvite
          ? `Welcome${firstName ? `, ${firstName}` : ""}! Choose the password you will use to sign in to KPI Manager.`
          : "Choose a new password for your KPI Manager account. Your other devices will be signed out."
      }
      footer={backToSignIn}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FormAlert>{error}</FormAlert>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <Avatar name={link.fullName || link.email} seed={link.email} size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-800">{link.fullName || link.email}</div>
            <div className="truncate text-xs text-slate-500">{link.email}</div>
          </div>
        </div>
        {/* Lets password managers associate the new password with the account. */}
        <input type="email" value={link.email} autoComplete="username" readOnly hidden />
        <div className="flex flex-col gap-3">
          <PasswordField
            label="New password"
            id="reset-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            autoFocus
          />
          <PasswordChecklist password={password} email={link.email} />
        </div>
        <div className="flex flex-col gap-2">
          <PasswordField
            label="Confirm the new password"
            id="reset-password-confirmation"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          {confirmation && !passwordsMatch ? (
            <span className="text-xs font-semibold text-red-600">The two passwords do not match.</span>
          ) : null}
          {confirmation && passwordsMatch && password ? (
            <span className="text-xs font-semibold text-emerald-600">The passwords match.</span>
          ) : null}
        </div>
        <SubmitButton loading={submitting} loadingLabel="Saving..." disabled={!canSubmit}>
          {isInvite ? "Activate my account" : "Save the new password"}
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

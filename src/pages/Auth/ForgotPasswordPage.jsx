import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import apiClient, { getApiErrorMessage } from "../../api/client";
import { ArrowLeftIcon, KeyIcon, MailIcon } from "../../components/icons.jsx";
import {
  AuthCard,
  AuthStatus,
  FormAlert,
  SubmitButton,
  TextField,
  primaryButtonClass,
  secondaryButtonClass,
} from "./components/authUi";

const backToSignIn = (
  <Link
    to="/login"
    className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300 transition hover:text-blue-600 dark:hover:text-blue-400"
  >
    <ArrowLeftIcon size={16} /> Back to sign in
  </Link>
);

export default function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/api/auth/forgot-password", { email });
      setSentTo(email.trim());
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to send the reset link."));
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AuthCard icon={MailIcon} iconTone="success" title="Check your inbox">
        <AuthStatus>
          <p className="text-[15px] leading-6 text-slate-600 dark:text-slate-300">
            If an active account exists for <span className="font-bold text-slate-900 dark:text-white">{sentTo}</span>, we have sent it a
            link to choose a new password.
          </p>
          <ul className="flex flex-col gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">
            <li>• The link is valid for 60 minutes and works once.</li>
            <li>• Nothing after a few minutes? Check your spam or junk folder.</li>
            <li>• Still nothing? Your administrator can send you a new link.</li>
          </ul>
          <div className="flex flex-col gap-3">
            <Link to="/login" state={{ email: sentTo }} className={primaryButtonClass}>
              Back to sign in
            </Link>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setSentTo("");
                setError("");
              }}
            >
              Use another e-mail
            </button>
          </div>
        </AuthStatus>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={KeyIcon}
      title="Forgot your password?"
      subtitle="Enter the e-mail of your account and we will send you a link to choose a new one."
      footer={backToSignIn}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FormAlert>{error}</FormAlert>
        <TextField
          label="E-mail"
          id="forgot-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          placeholder="firstname.lastname@avocarbon.com"
          autoFocus
          required
        />
        <SubmitButton loading={submitting} loadingLabel="Sending..." disabled={!email.trim()}>
          Send the reset link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

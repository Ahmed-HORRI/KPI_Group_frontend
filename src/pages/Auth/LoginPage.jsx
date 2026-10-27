import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { getHomePath, getSafeNextPath } from "../../auth/RouteGuards";
import { LoginIcon } from "../../components/icons.jsx";
import { AuthCard, FormAlert, PasswordField, SubmitButton, TextField } from "./components/authUi";

export default function LoginPage() {
  const { user, status, sessionExpired, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const destinationFor = (signedInUser) =>
    signedInUser.must_change_password ? "/change-password" : nextPath || getHomePath(signedInUser);

  if (status === "ready" && user && !submitting) {
    return <Navigate to={destinationFor(user)} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError("");
    try {
      const signedIn = await login(email, password);
      navigate(destinationFor(signedIn), { replace: true });
    } catch (err) {
      setPassword("");
      setError(getApiErrorMessage(err, "Unable to sign in."));
      setSubmitting(false);
    }
  };

  return (
    <AuthCard icon={LoginIcon} title="Sign in" subtitle="Welcome back. Use your KPI Manager account to open your dashboard.">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {sessionExpired ? <FormAlert tone="info">Your session has expired. Please sign in again.</FormAlert> : null}
        {location.state?.notice ? <FormAlert tone="success">{location.state.notice}</FormAlert> : null}
        <FormAlert>{error}</FormAlert>

        <TextField
          label="E-mail"
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          autoFocus={!email}
          placeholder="firstname.lastname@avocarbon.com"
          required
        />
        <PasswordField
          label="Password"
          id="login-password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          autoFocus={Boolean(email)}
          action={
            <Link
              to="/forgot-password"
              state={{ email }}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
            >
              Forgot your password?
            </Link>
          }
        />

        <div className="pt-1">
          <SubmitButton loading={submitting} loadingLabel="Signing in..." disabled={!email.trim() || !password}>
            Sign in
          </SubmitButton>
        </div>
      </form>
    </AuthCard>
  );
}

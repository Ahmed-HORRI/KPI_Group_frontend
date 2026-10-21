import { useEffect, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../../api/client";
import Avatar from "../../../components/Avatar.jsx";
import Dialog, { Spinner, buttonClasses } from "../../../components/Dialog.jsx";
import SelectMenu from "../../../components/SelectMenu.jsx";
import { AlertIcon, CloseIcon, EditIcon, KeyIcon, MailIcon, SearchIcon, UserPlusIcon } from "../../../components/icons.jsx";
import { ROLE_META } from "../../../constants/userRoles";
import { ROLE_ICONS } from "./roleIcons";
import { inputClass } from "../../Responsibles/components/ui.jsx";
import { isPasswordAcceptable } from "../../Auth/components/authUi";
import { ChoiceCard, FieldLabel, FormSection, PeopleIdBadge, TemporaryPasswordInput, ToggleRow } from "./formUi";


const ROLE_CHOICES = Object.entries(ROLE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
  hint: meta.description,
  icon: ROLE_ICONS[value],
}));

// Link between the account and a person of public.people.
function PersonPicker({ selected, onSelect }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      apiClient
        .get("/api/admin/people", { params: { search: term } })
        .then((res) => {
          if (!cancelled) setResults(res.data?.people || []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
        <Avatar name={selected.full_name || `Person ${selected.people_id}`} seed={selected.email || selected.people_id} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-slate-800 dark:text-white">
              {selected.full_name || `Person ${selected.people_id}`}
            </span>
            <PeopleIdBadge peopleId={selected.people_id} />
          </div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {selected.email || "No e-mail in the people table"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={14} /> Remove
        </button>
      </div>
    );
  }

  const showResults = search.trim().length >= 2;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          className={`${inputClass} pl-10`}
          placeholder="Search by name or e-mail..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search a person"
        />
        {loading ? (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            <Spinner />
          </span>
        ) : null}
      </div>
      {showResults && !loading && !results.length ? (
        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          No person matches "{search.trim()}".
        </div>
      ) : null}
      {results.length ? (
        <ul className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
          {results.map((person) => {
            const linked = Boolean(person.linked_user_id);
            return (
              <li key={person.people_id}>
                <button
                  type="button"
                  disabled={linked}
                  onClick={() => onSelect(person)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-slate-700/60"
                >
                  <Avatar name={person.full_name} seed={person.email || person.people_id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white">{person.full_name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{person.email || "No e-mail"}</span>
                  </span>
                  <PeopleIdBadge peopleId={person.people_id} />
                  {linked ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      Has an account
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// Create (user === null) or edit an account.
export default function UserFormModal({ user, currentUserId, onClose, onSaved }) {
  const isEdit = Boolean(user);
  const isSelf = isEdit && user.user_id === currentUserId;

  const [email, setEmail] = useState(user?.email || "");
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [role, setRole] = useState(user?.role || "user");
  const [isActive, setIsActive] = useState(user ? user.is_active : true);
  const [person, setPerson] = useState(user?.person || null);
  const [mode, setMode] = useState("invite");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectPerson = (selected) => {
    setPerson(selected);
    if (selected && !isEdit) {
      if (selected.email && !email.trim()) setEmail(selected.email);
      if (selected.full_name && !fullName.trim()) setFullName(selected.full_name);
    }
  };

  // Every account but an administrator's opens the KPI dashboard of its person,
  // so it needs one.
  const personRequired = role !== "admin";

  // E-mail typed instead of picking the person: select the person who has it.
  const pickPersonFromEmail = async () => {
    const value = email.trim().toLowerCase();
    if (isEdit || person || !value.includes("@")) return;
    try {
      const res = await apiClient.get("/api/admin/people", { params: { search: value } });
      const match = (res.data?.people || []).find(
        (candidate) => candidate.email.toLowerCase() === value && !candidate.linked_user_id
      );
      if (match) selectPerson(match);
    } catch {
      // Not blocking: the server also links the person with this e-mail on creation.
    }
  };

  const canSave =
    !saving &&
    (!personRequired || person) &&
    (isEdit || email.trim()) &&
    fullName.trim() &&
    (isEdit || mode === "invite" || isPasswordAcceptable(temporaryPassword, email));

  const save = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        const res = await apiClient.patch(`/api/admin/users/${user.user_id}`, {
          full_name: fullName,
          role,
          is_active: isActive,
          people_id: person?.people_id ?? null,
        });
        onSaved({ user: res.data.user, message: `${res.data.user.email} was updated.` });
      } else {
        const res = await apiClient.post("/api/admin/users", {
          email,
          full_name: fullName,
          role,
          people_id: person?.people_id ?? null,
          ...(mode === "temporary" ? { temporary_password: temporaryPassword } : {}),
        });
        onSaved({
          user: res.data.user,
          message:
            mode === "temporary"
              ? `Account created for ${res.data.user.email}. Give them the temporary password: they will choose their own at the first sign-in.`
              : res.data.email_sent
                ? `Account created. An invitation e-mail was sent to ${res.data.user.email}.`
                : null,
          manualLink: res.data.email_sent === false && mode === "invite" ? res.data.manual_link : null,
        });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to save the account."));
      setSaving(false);
    }
  };

  const footerHint = personRequired && !person
    ? "Pick the person this account belongs to: the user will open that person's KPI dashboard."
    : isEdit
    ? isSelf
      ? "You cannot change your own role or disable your own account."
      : "Changes apply immediately, also to signed-in sessions."
    : mode === "invite"
      ? "The invitation link is valid for 72 hours."
      : "The user must change this password at the first sign-in.";

  return (
    <Dialog
      size="lg"
      icon={isEdit ? EditIcon : UserPlusIcon}
      tone="brand"
      title={isEdit ? "Edit account" : "New account"}
      subtitle={
        isEdit ? `${user.full_name} · ${user.email}` : "Give someone access to the Responsible KPI Dashboard."
      }
      busy={saving}
      onClose={onClose}
      footerHint={footerHint}
      footer={
        <>
          <button type="button" className={buttonClasses.secondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="user-form" className={buttonClasses.primary} disabled={!canSave}>
            {saving ? <Spinner /> : null}
            {isEdit ? "Save changes" : mode === "invite" ? "Create and send invitation" : "Create account"}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={save} className="flex flex-col gap-6" noValidate>
        {error ? (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertIcon size={18} className="mt-px shrink-0" />
            {error}
          </div>
        ) : null}

        <FormSection title="Identity">
          <FieldLabel
            label="Linked person"
            required={personRequired}
            hint={personRequired ? "the user opens this person's KPI dashboard" : "optional for an administrator"}
          >
            <PersonPicker selected={person} onSelect={selectPerson} />
          </FieldLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldLabel label="E-mail" required={!isEdit} hint={isEdit ? "cannot be changed" : undefined} htmlFor="user-email">
              <input
                id="user-email"
                className={inputClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={pickPersonFromEmail}
                disabled={isEdit}
                autoComplete="off"
                placeholder="firstname.lastname@avocarbon.com"
              />
            </FieldLabel>
            <FieldLabel label="Full name" required htmlFor="user-full-name">
              <input
                id="user-full-name"
                className={inputClass}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Firstname LASTNAME"
              />
            </FieldLabel>
          </div>
        </FormSection>

        <FormSection title="Role">
          <div className="flex flex-col gap-2">
            <SelectMenu
              label="Role"
              hideLabel
              icon={ROLE_ICONS[role]}
              value={role}
              options={ROLE_CHOICES}
              onChange={setRole}
              disabled={isSelf}
              className="w-full"
            />
            <p className="px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{ROLE_META[role]?.description}</p>
          </div>
        </FormSection>

        {isEdit ? (
          <FormSection title="Access">
            <ToggleRow
              checked={isActive}
              onChange={setIsActive}
              disabled={isSelf}
              title={isActive ? "Account enabled" : "Account disabled"}
              description={
                isActive
                  ? "The user can sign in. Turn off to sign them out and block access."
                  : "The user cannot sign in. Turn on to give access back."
              }
            />
          </FormSection>
        ) : (
          <FormSection title="Activation">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Activation">
              <ChoiceCard
                name="mode"
                value="invite"
                checked={mode === "invite"}
                onChange={setMode}
                icon={MailIcon}
                title="Invitation e-mail"
                description="They choose their own password from a link."
              />
              <ChoiceCard
                name="mode"
                value="temporary"
                checked={mode === "temporary"}
                onChange={setMode}
                icon={KeyIcon}
                title="Temporary password"
                description="You give it to them; they change it at sign-in."
              />
            </div>
            {mode === "temporary" ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 animate-kpi-pop dark:border-slate-700 dark:bg-slate-800/40">
                <TemporaryPasswordInput
                  id="temporary-password"
                  value={temporaryPassword}
                  onChange={setTemporaryPassword}
                  email={email}
                />
              </div>
            ) : null}
          </FormSection>
        )}
      </form>
    </Dialog>
  );
}

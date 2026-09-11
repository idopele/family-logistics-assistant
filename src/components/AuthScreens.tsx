import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useUiPreferences } from '../i18n';
import { acceptInvite, bootstrapOwner, loadInvite, login, type AuthSession } from '../services/authClient';

interface AuthScreenProps {
  onAuthenticated: (session: AuthSession) => void;
}

export function LoginScreen({ onAuthenticated }: AuthScreenProps) {
  const { t } = useUiPreferences();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      onAuthenticated(await login(email, password));
    } catch {
      setError(t('authGenericError'));
    }
  }

  return (
    <AuthShell title={t('signIn')}>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <AuthInput label={t('email')} type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput label={t('password')} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error !== null ? <p className="auth-form__error">{error}</p> : null}
        <button className="add-event-form__save auth-form__submit" type="submit">{t('signIn')}</button>
      </form>
    </AuthShell>
  );
}

export function BootstrapOwnerScreen({ onAuthenticated }: AuthScreenProps) {
  const { t } = useUiPreferences();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      onAuthenticated(await bootstrapOwner(displayName, email, password, bootstrapToken));
    } catch {
      setError(t('authGenericError'));
    }
  }

  return (
    <AuthShell title={t('initialSetupTitle')}>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <AuthInput label={t('displayName')} value={displayName} onChange={setDisplayName} autoComplete="name" />
        <AuthInput label={t('email')} type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput label={t('password')} type="password" value={password} onChange={setPassword} autoComplete="new-password" help={t('passwordPolicy')} />
        <AuthInput label={t('bootstrapToken')} type="password" value={bootstrapToken} onChange={setBootstrapToken} autoComplete="one-time-code" />
        {error !== null ? <p className="auth-form__error">{error}</p> : null}
        <button className="add-event-form__save auth-form__submit" type="submit">{t('createFirstOwner')}</button>
      </form>
    </AuthShell>
  );
}

export function InviteAcceptScreen({ inviteToken, onAuthenticated }: AuthScreenProps & { inviteToken: string }) {
  const { t } = useUiPreferences();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void loadInvite(inviteToken)
      .then((invite) => {
        if (isCurrent) {
          setInviteEmail(invite.email);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setError(t('authGenericError'));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [inviteToken, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const session = await acceptInvite(inviteToken, displayName, password);
      removeInviteParam();
      onAuthenticated(session);
    } catch {
      setError(t('authGenericError'));
    }
  }

  return (
    <AuthShell title={t('acceptInvite')}>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        {inviteEmail !== null ? <p className="auth-form__hint">{t('inviteFor')}: {inviteEmail}</p> : null}
        <AuthInput label={t('displayName')} value={displayName} onChange={setDisplayName} autoComplete="name" />
        <AuthInput label={t('password')} type="password" value={password} onChange={setPassword} autoComplete="new-password" help={t('passwordPolicy')} />
        {error !== null ? <p className="auth-form__error">{error}</p> : null}
        <button className="add-event-form__save auth-form__submit" type="submit">{t('acceptInvite')}</button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useUiPreferences();

  return (
    <main className="auth-page" aria-labelledby="auth-title">
      <section className="auth-card">
        <p className="auth-card__eyebrow">{t('appName')}</p>
        <h1 id="auth-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

function AuthInput({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  help,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  help?: string;
}) {
  return (
    <label className="form-field auth-form-field">
      <span className="auth-form-field__label">{label}</span>
      <input className="auth-form-field__input" type={type} value={value} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} />
      {help !== undefined ? <small className="form-field__help">{help}</small> : null}
    </label>
  );
}

function removeInviteParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

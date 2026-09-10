import { useEffect, useMemo, useState } from 'react';
import { BootstrapOwnerScreen, InviteAcceptScreen, LoginScreen } from './components/AuthScreens.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { UiPreferencesProvider, useUiPreferences } from './i18n';
import { loadAuthStartupState, logout, type AuthSession } from './services/authClient.ts';

export function App() {
  return (
    <UiPreferencesProvider>
      <AuthenticatedApp />
    </UiPreferencesProvider>
  );
}

function AuthenticatedApp() {
  const { t } = useUiPreferences();
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get('invite'), []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    void loadAuthStartupState()
      .then((state) => {
        if (!isCurrent) {
          return;
        }

        setSession(state.session);
        setSetupRequired(state.setupRequired);
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleLogout() {
    await logout();
    setSession(null);
  }

  if (isLoading) {
    return <main className="auth-page"><section className="auth-card"><p>{t('authLoading')}</p></section></main>;
  }

  if (session !== null) {
    return <HomePage authSession={session} onLogout={() => void handleLogout()} />;
  }

  if (inviteToken !== null && inviteToken.trim() !== '') {
    return <InviteAcceptScreen inviteToken={inviteToken} onAuthenticated={setSession} />;
  }

  if (setupRequired) {
    return <BootstrapOwnerScreen onAuthenticated={setSession} />;
  }

  return <LoginScreen onAuthenticated={setSession} />;
}

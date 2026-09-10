import { type FormEvent, useEffect, useState } from 'react';
import { useUiPreferences } from '../i18n';
import {
  createAuthInvite,
  loadManagedUsers,
  revokeManagedUserSessions,
  setManagedUserStatus,
  type AuthRole,
  type AuthSession,
  type ManagedUser,
} from '../services/authClient';

export function UserManagementPanel({ session }: { session: AuthSession }) {
  const { t } = useUiPreferences();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<AuthRole, 'owner'>>('member');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageUsers = session.membership.role === 'owner' || session.membership.role === 'admin';

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    let isCurrent = true;

    void loadManagedUsers()
      .then((loadedUsers) => {
        if (isCurrent) {
          setUsers(loadedUsers);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setError(t('sharedDataLoadError'));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [canManageUsers, t]);

  if (!canManageUsers) {
    return null;
  }

  async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      setInviteUrl(await createAuthInvite(email, role));
      setEmail('');
    } catch {
      setError(t('sharedDataSaveError'));
    }
  }

  async function handleSetStatus(userId: string, status: 'active' | 'disabled') {
    await setManagedUserStatus(userId, status);
    setUsers(await loadManagedUsers());
  }

  async function handleRevokeSessions(userId: string) {
    await revokeManagedUserSessions(userId);
  }

  return (
    <section className="user-management" aria-label={t('manageUsers')}>
      <h3>{t('manageUsers')}</h3>
      <form className="user-management__invite" onSubmit={(event) => void handleCreateInvite(event)}>
        <label className="form-field">
          <span>{t('email')}</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('role')}</span>
          <select value={role} onChange={(event) => setRole(event.target.value as Exclude<AuthRole, 'owner'>)}>
            <option value="admin">{t('admin')}</option>
            <option value="member">{t('member')}</option>
            <option value="viewer">{t('viewer')}</option>
          </select>
        </label>
        <button type="submit">{t('createInvite')}</button>
      </form>
      {inviteUrl !== null ? <p className="user-management__invite-link">{t('inviteLink')}: {inviteUrl}</p> : null}
      {error !== null ? <p className="auth-form__error">{error}</p> : null}
      <div className="user-management__list">
        {users.map((user) => (
          <article key={user.id} className="user-management__row">
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
            <span>{t(user.role)} · {t(user.status)}</span>
            <div>
              <button type="button" onClick={() => void handleSetStatus(user.id, user.status === 'active' ? 'disabled' : 'active')}>
                {user.status === 'active' ? t('disableAccount') : t('enableAccount')}
              </button>
              <button type="button" onClick={() => void handleRevokeSessions(user.id)}>
                {t('revokeSessions')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

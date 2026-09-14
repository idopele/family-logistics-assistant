import { type FormEvent, useEffect, useState } from 'react';
import { children as seedChildren } from '../data/children';
import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences } from '../i18n';
import {
  createAuthInvite,
  loadManagedUsers,
  revokeManagedUserSessions,
  saveManagedSharedView,
  setManagedUserStatus,
  type AuthRole,
  type AuthSession,
  type ManagedSharedView,
  type ManagedUser,
} from '../services/authClient';
import type { EventCategory, PermissionScope } from '../models';

export function UserManagementPanel({ session }: { session: AuthSession }) {
  const { language, t } = useUiPreferences();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [sharedViews, setSharedViews] = useState<ManagedSharedView[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<AuthRole, 'owner'>>('member');
  const [sharedViewDraft, setSharedViewDraft] = useState(createEmptySharedViewDraft());
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageUsers = session.membership.role === 'owner' || session.membership.role === 'admin';

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    let isCurrent = true;

    void loadManagedUsers()
      .then((loadedState) => {
        if (isCurrent) {
          setUsers(loadedState.users);
          setSharedViews(loadedState.sharedViews);
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
    const loadedState = await loadManagedUsers();
    setUsers(loadedState.users);
    setSharedViews(loadedState.sharedViews);
  }

  async function handleRevokeSessions(userId: string) {
    await revokeManagedUserSessions(userId);
  }

  async function handleSaveSharedView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await saveManagedSharedView(sharedViewDraft);
      const loadedState = await loadManagedUsers();
      setUsers(loadedState.users);
      setSharedViews(loadedState.sharedViews);
      setSharedViewDraft(createEmptySharedViewDraft());
    } catch {
      setError(t('sharedDataSaveError'));
    }
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
      <section className="user-management__shared-views" aria-label={t('sharedViews')}>
        <h4>{t('sharedViews')}</h4>
        <form className="user-management__shared-view-form" onSubmit={(event) => void handleSaveSharedView(event)}>
          <label className="form-field">
            <span>{t('title')}</span>
            <input value={sharedViewDraft.name} onChange={(event) => setSharedViewDraft({ ...sharedViewDraft, name: event.target.value })} />
          </label>
          <fieldset>
            <legend>{t('manageUsers')}</legend>
            {users.filter((user) => user.role !== 'owner').map((user) => (
              <label key={user.id}>
                <input
                  type="checkbox"
                  checked={sharedViewDraft.userIds.includes(user.id)}
                  onChange={() => setSharedViewDraft(toggleDraftArray(sharedViewDraft, 'userIds', user.id))}
                />
                {user.displayName}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t('access')}</legend>
            <label>
              <input
                type="checkbox"
                checked={sharedViewDraft.allMembers}
                onChange={(event) => setSharedViewDraft({ ...sharedViewDraft, allMembers: event.target.checked })}
              />
              {t('allFamilyMembers')}
            </label>
            {!sharedViewDraft.allMembers ? seedChildren.map((child) => (
              <label key={child.id}>
                <input
                  type="checkbox"
                  checked={sharedViewDraft.memberIds.includes(child.id)}
                  onChange={() => setSharedViewDraft(toggleDraftArray(sharedViewDraft, 'memberIds', child.id))}
                />
                {child.name}
              </label>
            )) : null}
          </fieldset>
          <fieldset>
            <legend>{t('activityTypeFilter')}</legend>
            <label>
              <input
                type="checkbox"
                checked={sharedViewDraft.allCategories}
                onChange={(event) => setSharedViewDraft({ ...sharedViewDraft, allCategories: event.target.checked })}
              />
              {t('allActivityTypes')}
            </label>
            {!sharedViewDraft.allCategories ? manageableCategories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={sharedViewDraft.categories.includes(category)}
                  onChange={() => setSharedViewDraft(toggleDraftArray(sharedViewDraft, 'categories', category))}
                />
                {getEventCategoryLabel({ category, customCategoryLabel: null }, language)}
              </label>
            )) : null}
          </fieldset>
          <fieldset>
            <legend>{t('permissions')}</legend>
            {sharedViewPermissions.map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  checked={sharedViewDraft.permissions.includes(permission)}
                  onChange={() => setSharedViewDraft(toggleDraftArray(sharedViewDraft, 'permissions', permission))}
                />
                {permissionLabel(permission, t)}
              </label>
            ))}
          </fieldset>
          <button type="submit">{t('saveSharedView')}</button>
        </form>
        <div className="user-management__shared-view-list">
          {sharedViews.map((view) => (
            <article key={view.id} className="user-management__row">
              <strong>{view.name}</strong>
              <span>
                {t('access')}: {view.allMembers ? t('allFamilyMembers') : view.memberIds.join(', ')} · {view.allCategories ? t('allActivityTypes') : view.categories.join(', ')}
              </span>
              <span>{t('permissions')}: {view.permissions.map((permission) => permissionLabel(permission, t)).join(', ')}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

const manageableCategories: EventCategory[] = [
  'school',
  'basketball',
  'dance',
  'doctor',
  'privateLesson',
  'scouts',
  'dentist',
  'friends',
  'family',
  'work',
  'meal',
  'other',
];

const sharedViewPermissions: PermissionScope[] = [
  'view_schedule',
  'edit_schedule',
  'view_transportation',
  'edit_transportation',
  'view_contacts',
  'receive_notifications',
];

function createEmptySharedViewDraft(): Omit<ManagedSharedView, 'id'> {
  return {
    name: '',
    description: null,
    active: true,
    allMembers: false,
    allCategories: false,
    userIds: [],
    memberIds: [],
    categories: [],
    permissions: ['view_schedule'],
  };
}

function toggleDraftArray<Key extends 'userIds' | 'memberIds' | 'categories' | 'permissions'>(
  draft: Omit<ManagedSharedView, 'id'>,
  key: Key,
  value: Omit<ManagedSharedView, 'id'>[Key][number],
): Omit<ManagedSharedView, 'id'> {
  const values = draft[key] as string[];
  const nextValues = values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];

  return { ...draft, [key]: nextValues };
}

function permissionLabel(permission: PermissionScope, t: ReturnType<typeof useUiPreferences>['t']): string {
  const labels: Record<PermissionScope, string> = {
    view_schedule: t('viewSchedule'),
    edit_schedule: t('editSchedule'),
    view_transportation: t('viewTransportationPermission'),
    edit_transportation: t('editTransportationPermission'),
    view_contacts: t('viewContacts'),
    receive_notifications: t('receiveNotifications'),
    manage_users: t('manageUsers'),
    manage_shared_views: t('manageSharedViews'),
  };

  return labels[permission];
}

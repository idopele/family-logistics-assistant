import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { children as seedChildren } from '../data/children';
import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences, type TranslationKey } from '../i18n';
import {
  createAuthInvite,
  loadManagedUsers,
  revokeManagedUserSessions,
  saveManagedSharedView,
  saveManagedUserPermissions,
  setManagedUserStatus,
  type AuthRole,
  type AuthSession,
  type ManagedSharedView,
  type ManagedUser,
  type ManagedUserPermissions,
} from '../services/authClient';
import type { EventCategory, PermissionScope } from '../models';

type UserManagementTab = 'details' | 'permissions' | 'status';
type PermissionPreset = 'none' | 'view' | 'edit' | 'operational';

type PermissionDraft = ManagedUserPermissions & { preset: PermissionPreset | null };

export function UserManagementPanel({ session }: { session: AuthSession }) {
  const { t } = useUiPreferences();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [sharedViews, setSharedViews] = useState<ManagedSharedView[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UserManagementTab>('permissions');
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft>(createNoAccessDraft());
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<AuthRole, 'owner'>>('member');
  const [sharedViewDraft, setSharedViewDraft] = useState(createEmptySharedViewDraft());
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const canManageUsers = session.membership.role === 'owner' || session.membership.role === 'admin';

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    let isCurrent = true;

    void loadManagedUsers()
      .then((loadedState) => {
        if (!isCurrent) {
          return;
        }

        setUsers(loadedState.users);
        setSharedViews(loadedState.sharedViews);
        setSelectedUserId((currentUserId) => currentUserId ?? loadedState.users[0]?.id ?? null);
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

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );
  const selectedUserAccess = useMemo(
    () => (selectedUser === null ? null : deriveEffectiveUserPermissions(selectedUser.id, sharedViews)),
    [selectedUser, sharedViews],
  );

  useEffect(() => {
    if (selectedUserAccess !== null) {
      setPermissionDraft({ ...selectedUserAccess, preset: null });
    }
  }, [selectedUserAccess]);

  if (!canManageUsers) {
    return null;
  }

  async function refreshUsers() {
    const loadedState = await loadManagedUsers();
    setUsers(loadedState.users);
    setSharedViews(loadedState.sharedViews);
    setSelectedUserId((currentUserId) => currentUserId ?? loadedState.users[0]?.id ?? null);
    return loadedState;
  }

  async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      setInviteUrl(await createAuthInvite(email, role));
      setEmail('');
    } catch {
      setError(t('sharedDataSaveError'));
    }
  }

  async function handleSetStatus(userId: string, status: 'active' | 'disabled') {
    setError(null);
    setSuccessMessage(null);

    try {
      await setManagedUserStatus(userId, status);
      await refreshUsers();
    } catch {
      setError(t('sharedDataSaveError'));
    }
  }

  async function handleRevokeSessions(userId: string) {
    setError(null);
    setSuccessMessage(null);

    try {
      await revokeManagedUserSessions(userId);
      setSuccessMessage(t('permissionsSavedSuccessfully'));
    } catch {
      setError(t('sharedDataSaveError'));
    }
  }

  async function handleSavePermissions() {
    if (selectedUser === null || selectedUser.role === 'owner' || selectedUser.role === 'admin') {
      return;
    }

    const normalizedDraft = normalizeDraftDependencies(permissionDraft);
    const isNoAccess = normalizedDraft.permissions.length === 0;

    if (!isNoAccess && (!normalizedDraft.allMembers && normalizedDraft.memberIds.length === 0)) {
      setError(t('selectAtLeastOneMemberAndActivity'));
      return;
    }

    if (!isNoAccess && (!normalizedDraft.allCategories && normalizedDraft.categories.length === 0)) {
      setError(t('selectAtLeastOneMemberAndActivity'));
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await saveManagedUserPermissions(selectedUser.id, normalizedDraft);
      const loadedState = await refreshUsers();
      const refreshedAccess = deriveEffectiveUserPermissions(selectedUser.id, loadedState.sharedViews);
      setPermissionDraft({ ...refreshedAccess, preset: null });
      setSuccessMessage(t('permissionsSavedSuccessfully'));
    } catch {
      setPermissionDraft(normalizedDraft);
      setError(t('sharedDataSaveError'));
    }
  }

  async function handleSaveSharedView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      await saveManagedSharedView(sharedViewDraft);
      await refreshUsers();
      setSharedViewDraft(createEmptySharedViewDraft());
      setSuccessMessage(t('permissionsSavedSuccessfully'));
    } catch {
      setError(t('sharedDataSaveError'));
    }
  }

  function handleSelectUser(userId: string) {
    setSelectedUserId(userId);
    setActiveTab('permissions');
    setError(null);
    setSuccessMessage(null);
  }

  function applyPreset(preset: PermissionPreset) {
    const presetPermissions = presetPermissionValues[preset];
    setPermissionDraft(normalizeDraftDependencies({ ...permissionDraft, preset, permissions: presetPermissions }));
  }

  const isFineGrainedEditorVisible = selectedUser?.role === 'member' || selectedUser?.role === 'viewer';
  const normalizedPermissionDraft = normalizeDraftDependencies(permissionDraft);
  const isNoAccessDraft = normalizedPermissionDraft.permissions.length === 0;
  const isSaveDisabled =
    selectedUser === null ||
    !isFineGrainedEditorVisible ||
    (!isNoAccessDraft && (!normalizedPermissionDraft.allMembers && normalizedPermissionDraft.memberIds.length === 0)) ||
    (!isNoAccessDraft && (!normalizedPermissionDraft.allCategories && normalizedPermissionDraft.categories.length === 0));

  return (
    <section className="user-management" aria-label={t('manageUsers')}>
      <div className="user-management__header">
        <h3>{t('manageUsers')}</h3>
        <p>{t('userPermissionsIntro')}</p>
      </div>

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
      {successMessage !== null ? <p className="user-management__success">{successMessage}</p> : null}

      <div className="user-management__workspace">
        <nav className="user-management__user-list" aria-label={t('members')}>
          {users.map((user) => (
            <button
              key={user.id}
              className="user-management__user-button"
              type="button"
              aria-pressed={selectedUser?.id === user.id}
              onClick={() => handleSelectUser(user.id)}
            >
              <strong>{user.displayName}</strong>
              <span>{t(user.role)} · {t(user.status)}</span>
            </button>
          ))}
        </nav>

        {selectedUser !== null ? (
          <article className="user-management__detail">
            <header className="user-management__detail-header">
              <div>
                <h4>{selectedUser.displayName}</h4>
                <p>{selectedUser.email}</p>
              </div>
              <span>{t(selectedUser.role)}</span>
            </header>

            <div className="user-management__tabs" role="tablist" aria-label={t('manageUsers')}>
              {userManagementTabs.map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>
                  {t(tab)}
                </button>
              ))}
            </div>

            {activeTab === 'details' ? <UserDetails user={selectedUser} /> : null}
            {activeTab === 'permissions' ? (
              <PermissionsTab
                user={selectedUser}
                draft={normalizedPermissionDraft}
                effective={selectedUserAccess ?? createNoAccessDraft()}
                onDraftChange={setPermissionDraft}
                onPreset={applyPreset}
                onSave={() => void handleSavePermissions()}
                isSaveDisabled={isSaveDisabled}
              />
            ) : null}
            {activeTab === 'status' ? (
              <StatusTab
                user={selectedUser}
                onSetStatus={handleSetStatus}
                onRevokeSessions={handleRevokeSessions}
              />
            ) : null}
          </article>
        ) : null}
      </div>

      <section className="user-management__advanced">
        <button type="button" onClick={() => setIsAdvancedOpen((isOpen) => !isOpen)} aria-expanded={isAdvancedOpen}>
          {t('advancedPermissions')}
        </button>
        {isAdvancedOpen ? (
          <AdvancedSharedViewsEditor
            users={users}
            sharedViews={sharedViews}
            sharedViewDraft={sharedViewDraft}
            onDraftChange={setSharedViewDraft}
            onSave={handleSaveSharedView}
          />
        ) : null}
      </section>
    </section>
  );
}

function UserDetails({ user }: { user: ManagedUser }) {
  const { t } = useUiPreferences();

  return (
    <section className="user-management__tab-panel">
      <dl className="user-management__details-list">
        <div><dt>{t('email')}</dt><dd>{user.email}</dd></div>
        <div><dt>{t('role')}</dt><dd>{t(user.role)}</dd></div>
        <div><dt>{t('status')}</dt><dd>{t(user.status)}</dd></div>
      </dl>
    </section>
  );
}

function PermissionsTab({
  user,
  draft,
  effective,
  onDraftChange,
  onPreset,
  onSave,
  isSaveDisabled,
}: {
  user: ManagedUser;
  draft: PermissionDraft;
  effective: ManagedUserPermissions;
  onDraftChange: (draft: PermissionDraft) => void;
  onPreset: (preset: PermissionPreset) => void;
  onSave: () => void;
  isSaveDisabled: boolean;
}) {
  const { language, t } = useUiPreferences();

  if (user.role === 'owner') {
    return <p className="user-management__role-note">{t('ownerFullAccessMessage')}</p>;
  }

  if (user.role === 'admin') {
    return <p className="user-management__role-note">{t('adminFullAccessMessage')}</p>;
  }

  return (
    <section className="user-management__tab-panel user-management__permissions-panel">
      <div className="user-management__access-summary">
        <strong>{t('accessSummary')}</strong>
        <span>{formatAccessSummary(effective, language, t)}</span>
      </div>
      {effective.permissions.length === 0 ? <p className="user-management__empty-note">{t('noPermissionsConfigured')}</p> : null}

      <div className="user-management__presets" aria-label={t('permissionPresets')}>
        {permissionPresets.map((preset) => (
          <button key={preset} type="button" aria-pressed={draft.preset === preset} onClick={() => onPreset(preset)}>
            {t(presetTranslationKeys[preset])}
          </button>
        ))}
      </div>

      <PermissionChipSection
        title={t('accessToMembers')}
        items={seedChildren.map((child) => ({ id: child.id, label: child.name }))}
        selectedIds={draft.allMembers ? seedChildren.map((child) => child.id) : draft.memberIds}
        onToggle={(memberId) => onDraftChange({ ...draft, preset: null, allMembers: false, memberIds: toggleString(draft.memberIds, memberId) })}
        onSelectAll={() => onDraftChange({ ...draft, preset: null, allMembers: true, memberIds: [] })}
        onClear={() => onDraftChange({ ...draft, preset: null, allMembers: false, memberIds: [] })}
      />

      <PermissionChipSection
        title={t('accessToActivities')}
        items={manageableCategories.map((category) => ({
          id: category,
          label: getEventCategoryLabel({ category, customCategoryLabel: null }, language),
        }))}
        selectedIds={draft.allCategories ? manageableCategories : draft.categories}
        onToggle={(category) =>
          onDraftChange({ ...draft, preset: null, allCategories: false, categories: toggleString(draft.categories, category) as EventCategory[] })
        }
        onSelectAll={() => onDraftChange({ ...draft, preset: null, allCategories: true, categories: [] })}
        onClear={() => onDraftChange({ ...draft, preset: null, allCategories: false, categories: [] })}
      />

      <section className="user-management__permission-section">
        <h5>{t('actionPermissions')}</h5>
        <div className="user-management__checkbox-grid">
          {simpleActionPermissions.map((permission) => (
            <label key={permission}>
              <input
                type="checkbox"
                checked={draft.permissions.includes(permission)}
                onChange={() => onDraftChange(normalizeDraftDependencies({ ...draft, preset: null, permissions: toggleString(draft.permissions, permission) as PermissionScope[] }))}
              />
              {permissionLabel(permission, t)}
            </label>
          ))}
        </div>
      </section>

      {isSaveDisabled ? <p className="user-management__validation-note">{t('selectAtLeastOneMemberAndActivity')}</p> : null}
      <button className="user-management__save" type="button" disabled={isSaveDisabled} onClick={onSave}>
        {t('savePermissions')}
      </button>
    </section>
  );
}

function PermissionChipSection({
  title,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: {
  title: string;
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const { t } = useUiPreferences();
  const selectedSet = new Set(selectedIds);

  return (
    <section className="user-management__permission-section">
      <div className="user-management__section-title">
        <h5>{title}</h5>
        <div>
          <button type="button" onClick={onSelectAll}>{t('selectAll')}</button>
          <button type="button" onClick={onClear}>{t('clear')}</button>
        </div>
      </div>
      <div className="user-management__permission-chips">
        {items.map((item) => (
          <label key={item.id}>
            <input type="checkbox" checked={selectedSet.has(item.id)} onChange={() => onToggle(item.id)} />
            {item.label}
          </label>
        ))}
      </div>
    </section>
  );
}

function StatusTab({
  user,
  onSetStatus,
  onRevokeSessions,
}: {
  user: ManagedUser;
  onSetStatus: (userId: string, status: 'active' | 'disabled') => void | Promise<void>;
  onRevokeSessions: (userId: string) => void | Promise<void>;
}) {
  const { t } = useUiPreferences();

  return (
    <section className="user-management__tab-panel user-management__status-actions">
      <p>{t(user.status)}</p>
      <button type="button" onClick={() => void onSetStatus(user.id, user.status === 'active' ? 'disabled' : 'active')}>
        {user.status === 'active' ? t('disableAccount') : t('enableAccount')}
      </button>
      <button type="button" onClick={() => void onRevokeSessions(user.id)}>
        {t('revokeSessions')}
      </button>
    </section>
  );
}

function AdvancedSharedViewsEditor({
  users,
  sharedViews,
  sharedViewDraft,
  onDraftChange,
  onSave,
}: {
  users: ManagedUser[];
  sharedViews: ManagedSharedView[];
  sharedViewDraft: Omit<ManagedSharedView, 'id'>;
  onDraftChange: (draft: Omit<ManagedSharedView, 'id'>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { language, t } = useUiPreferences();

  return (
    <section className="user-management__shared-views" aria-label={t('sharedViews')}>
      <h4>{t('sharedViews')}</h4>
      <form className="user-management__shared-view-form" onSubmit={(event) => void onSave(event)}>
        <label className="form-field">
          <span>{t('title')}</span>
          <input value={sharedViewDraft.name} onChange={(event) => onDraftChange({ ...sharedViewDraft, name: event.target.value })} />
        </label>
        <fieldset>
          <legend>{t('manageUsers')}</legend>
          {users.filter((user) => user.role !== 'owner').map((user) => (
            <label key={user.id}>
              <input
                type="checkbox"
                checked={sharedViewDraft.userIds.includes(user.id)}
                onChange={() => onDraftChange(toggleDraftArray(sharedViewDraft, 'userIds', user.id))}
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
              onChange={(event) => onDraftChange({ ...sharedViewDraft, allMembers: event.target.checked })}
            />
            {t('allFamilyMembers')}
          </label>
          {!sharedViewDraft.allMembers ? seedChildren.map((child) => (
            <label key={child.id}>
              <input
                type="checkbox"
                checked={sharedViewDraft.memberIds.includes(child.id)}
                onChange={() => onDraftChange(toggleDraftArray(sharedViewDraft, 'memberIds', child.id))}
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
              onChange={(event) => onDraftChange({ ...sharedViewDraft, allCategories: event.target.checked })}
            />
            {t('allActivityTypes')}
          </label>
          {!sharedViewDraft.allCategories ? manageableCategories.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                checked={sharedViewDraft.categories.includes(category)}
                onChange={() => onDraftChange(toggleDraftArray(sharedViewDraft, 'categories', category))}
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
                onChange={() => onDraftChange(toggleDraftArray(sharedViewDraft, 'permissions', permission))}
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
  );
}

const userManagementTabs: UserManagementTab[] = ['details', 'permissions', 'status'];
const permissionPresets: PermissionPreset[] = ['none', 'view', 'edit', 'operational'];

const presetTranslationKeys: Record<PermissionPreset, TranslationKey> = {
  none: 'presetNoAccess',
  view: 'presetViewOnly',
  edit: 'presetViewEdit',
  operational: 'presetFullOperational',
};

const presetPermissionValues: Record<PermissionPreset, PermissionScope[]> = {
  none: [],
  view: ['view_schedule'],
  edit: ['view_schedule', 'edit_schedule'],
  operational: ['view_schedule', 'edit_schedule', 'view_transportation', 'edit_transportation', 'receive_notifications', 'view_contacts'],
};

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

const simpleActionPermissions: PermissionScope[] = [
  'view_schedule',
  'edit_schedule',
  'view_transportation',
  'edit_transportation',
  'receive_notifications',
  'view_contacts',
];

const sharedViewPermissions: PermissionScope[] = simpleActionPermissions;

function createNoAccessDraft(): PermissionDraft {
  return {
    allMembers: false,
    allCategories: false,
    memberIds: [],
    categories: [],
    permissions: [],
    preset: 'none',
  };
}

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

export function deriveEffectiveUserPermissions(userId: string, sharedViews: ManagedSharedView[]): ManagedUserPermissions {
  const userViews = sharedViews.filter((view) => view.active && view.userIds.includes(userId));
  const memberIds = new Set<string>();
  const categories = new Set<EventCategory>();
  const permissions = new Set<PermissionScope>();
  let allMembers = false;
  let allCategories = false;

  for (const view of userViews) {
    allMembers = allMembers || view.allMembers;
    allCategories = allCategories || view.allCategories;
    view.memberIds.forEach((memberId) => memberIds.add(memberId));
    view.categories.forEach((category) => categories.add(category));
    view.permissions.forEach((permission) => permissions.add(permission));
  }

  return normalizeUserPermissions({
    allMembers,
    allCategories,
    memberIds: allMembers ? [] : Array.from(memberIds),
    categories: allCategories ? [] : Array.from(categories),
    permissions: sharedViewPermissions.filter((permission) => permissions.has(permission)),
  });
}

export function normalizeUserPermissions(permissions: ManagedUserPermissions): ManagedUserPermissions {
  const normalizedPermissions = normalizePermissionList(permissions.permissions);

  return {
    allMembers: permissions.allMembers,
    allCategories: permissions.allCategories,
    memberIds: permissions.allMembers ? [] : Array.from(new Set(permissions.memberIds)),
    categories: permissions.allCategories ? [] : Array.from(new Set(permissions.categories)),
    permissions: normalizedPermissions,
  };
}

export function normalizeDraftDependencies(draft: PermissionDraft): PermissionDraft {
  return { ...normalizeUserPermissions(draft), preset: draft.preset };
}

function normalizePermissionList(permissions: PermissionScope[]): PermissionScope[] {
  const selected = new Set(permissions);

  if (selected.has('edit_schedule') || selected.has('receive_notifications')) {
    selected.add('view_schedule');
  }

  if (selected.has('edit_transportation')) {
    selected.add('view_transportation');
  }

  return sharedViewPermissions.filter((permission) => selected.has(permission));
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

function toggleString<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((currentValue) => currentValue !== value) : [...values, value];
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

function formatAccessSummary(
  permissions: ManagedUserPermissions,
  language: ReturnType<typeof useUiPreferences>['language'],
  t: ReturnType<typeof useUiPreferences>['t'],
): string {
  if (permissions.permissions.length === 0) {
    return t('presetNoAccess');
  }

  const members = permissions.allMembers
    ? t('allFamilyMembers')
    : permissions.memberIds.map((memberId) => seedChildren.find((child) => child.id === memberId)?.name ?? memberId).join(' + ');
  const categories = permissions.allCategories
    ? t('allActivityTypes')
    : permissions.categories.map((category) => getEventCategoryLabel({ category, customCategoryLabel: null }, language)).join(', ');
  const actions = permissions.permissions.map((permission) => permissionLabel(permission, t)).join(', ');

  return [members, categories, actions].filter((part) => part.trim() !== '').join(' · ');
}

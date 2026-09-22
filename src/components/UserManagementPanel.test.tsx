import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { translations } from '../i18n';
import type { AuthSession, ManagedSharedView, ManagedUserPermissions } from '../services/authClient';
import { saveManagedUserPermissions } from '../services/authClient';
import { UserManagementPanel, deriveEffectiveUserPermissions, normalizeDraftDependencies, normalizeUserPermissions } from './UserManagementPanel';

const ownerSession: AuthSession = {
  authenticated: true,
  user: { email: 'owner@example.com', displayName: 'Owner', status: 'active', lastLoginAt: null },
  workspace: { id: 'default-family-workspace', name: 'Family', type: 'family' },
  membership: { role: 'owner', status: 'active', scheduleMemberId: null },
};

function sharedView(overrides: Partial<ManagedSharedView>): ManagedSharedView {
  return {
    id: 'view-a',
    name: 'Advanced view',
    description: null,
    active: true,
    allMembers: false,
    allCategories: false,
    userIds: ['user-member'],
    memberIds: ['daniel'],
    categories: ['school'],
    permissions: ['view_schedule'],
    ...overrides,
  };
}

describe('UserManagementPanel Step 14.2 permissions UX', () => {
  it('renders a user-centric permissions settings structure', () => {
    const markup = renderToStaticMarkup(<UserManagementPanel session={ownerSession} />);

    expect(markup).toContain(translations.he.manageUsers);
    expect(markup).toContain(translations.he.userPermissionsIntro);
    expect(markup).toContain(translations.he.advancedPermissions);
    expect(markup).not.toContain('Scope');
    expect(markup).not.toContain('Union');
  });

  it('keeps Hebrew and English labels available', () => {
    expect(translations.he.permissions).toBeTruthy();
    expect(translations.he.presetNoAccess).toBeTruthy();
    expect(translations.en.permissions).toBe('Permissions');
    expect(translations.en.presetViewOnly).toBe('View only');
    expect(translations.en.savePermissions).toBe('Save permissions');
  });

  it('derives the effective union from existing shared views', () => {
    const effective = deriveEffectiveUserPermissions('user-member', [
      sharedView({ id: 'view-school', memberIds: ['daniel'], categories: ['school'], permissions: ['view_schedule'] }),
      sharedView({ id: 'view-dance', memberIds: ['emanuel'], categories: ['dance'], permissions: ['edit_schedule'] }),
    ]);

    expect(effective.memberIds).toEqual(['daniel', 'emanuel']);
    expect(effective.categories).toEqual(['school', 'dance']);
    expect(effective.permissions).toEqual(['view_schedule', 'edit_schedule']);
  });

  it('ignores unrelated advanced shared views for another user', () => {
    const effective = deriveEffectiveUserPermissions('user-member', [
      sharedView({ id: 'own-view', userIds: ['user-member'], memberIds: ['daniel'], categories: ['school'] }),
      sharedView({ id: 'other-view', userIds: ['other-user'], memberIds: ['emanuel'], categories: ['dance'] }),
    ]);

    expect(effective.memberIds).toEqual(['daniel']);
    expect(effective.categories).toEqual(['school']);
  });

  it('preserves default-deny when no access is configured', () => {
    const effective = deriveEffectiveUserPermissions('user-member', []);

    expect(effective).toEqual({ allMembers: false, allCategories: false, memberIds: [], categories: [], permissions: [] });
  });

  it('normalizes all-member and all-category selections without ambiguous empty sets', () => {
    const normalized = normalizeUserPermissions({
      allMembers: true,
      allCategories: true,
      memberIds: ['daniel'],
      categories: ['school'],
      permissions: ['view_schedule'],
    });

    expect(normalized.memberIds).toEqual([]);
    expect(normalized.categories).toEqual([]);
    expect(normalized.allMembers).toBe(true);
    expect(normalized.allCategories).toBe(true);
  });

  it('edit schedule implies view schedule', () => {
    expect(normalizeDraftDependencies({
      allMembers: false,
      allCategories: false,
      memberIds: ['daniel'],
      categories: ['school'],
      permissions: ['edit_schedule'],
      preset: null,
    }).permissions).toEqual(['view_schedule', 'edit_schedule']);
  });

  it('edit transportation implies view transportation', () => {
    expect(normalizeDraftDependencies({
      allMembers: false,
      allCategories: false,
      memberIds: ['daniel'],
      categories: ['school'],
      permissions: ['edit_transportation'],
      preset: null,
    }).permissions).toEqual(['view_transportation', 'edit_transportation']);
  });

  it('receive notifications implies view schedule', () => {
    expect(normalizeDraftDependencies({
      allMembers: false,
      allCategories: false,
      memberIds: ['daniel'],
      categories: ['school'],
      permissions: ['receive_notifications'],
      preset: null,
    }).permissions).toEqual(['view_schedule', 'receive_notifications']);
  });

  it('sends simple per-user permissions through the auth users adapter', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const permissions: ManagedUserPermissions = {
      allMembers: false,
      allCategories: false,
      memberIds: ['daniel'],
      categories: ['school'],
      permissions: ['view_schedule'],
    };

    await saveManagedUserPermissions('user-member', permissions, fetcher as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith('/api/auth/users', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'saveUserPermissions', userId: 'user-member', permissions }),
    }));
  });

  it('preserves selections if the simple permissions save fails', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'failed' }), { status: 403 }));

    await expect(saveManagedUserPermissions('user-member', {
      allMembers: false,
      allCategories: false,
      memberIds: ['daniel'],
      categories: ['school'],
      permissions: ['view_schedule'],
    }, fetcher as typeof fetch)).rejects.toThrow('Could not save user permissions.');
  });
});

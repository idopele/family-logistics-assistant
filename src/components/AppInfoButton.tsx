import { useState } from 'react';
import { useUiPreferences } from '../i18n';
import type { AuthSession } from '../services/authClient';
import { appBuildInfo, formatBuildDate, type AppBuildInfo } from '../services/appInfo';
import { hasPermission } from '../services/authorization';
import { PushNotificationsControl } from './PushNotificationsControl';
import { UserManagementPanel } from './UserManagementPanel';

interface AppInfoButtonProps {
  buildInfo?: AppBuildInfo;
  defaultOpen?: boolean;
  authSession?: AuthSession;
  onLogout?: () => void;
}

export function AppInfoButton({ buildInfo = appBuildInfo, defaultOpen = false, authSession, onLogout }: AppInfoButtonProps) {
  const { language, t } = useUiPreferences();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const environmentLabel = buildInfo.environment === 'production' ? t('production') : t('local');
  const canUseNotifications = authSession === undefined || hasPermission(authSession.authorization, 'receive_notifications');

  return (
    <div className="app-info">
      <button
        className="app-info__button"
        type="button"
        aria-label={t('appInfo')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
      >
        ⓘ
      </button>
      {isOpen ? (
        <section className="app-info__panel" role="dialog" aria-label={t('appInfo')}>
          <h2>{t('appName')}</h2>
          <dl className="app-info__list">
            {authSession !== undefined ? <AppInfoRow label={t('signedInAs')} value={authSession.user.displayName} /> : null}
            {authSession !== undefined ? <AppInfoRow label={t('role')} value={t(authSession.membership.role)} /> : null}
            <AppInfoRow label={t('version')} value={buildInfo.version} />
            <AppInfoRow label={t('build')} value={buildInfo.shortSha} />
            <AppInfoRow label={t('environment')} value={environmentLabel} />
            <AppInfoRow label={t('buildDate')} value={formatBuildDate(buildInfo.buildTime, language)} />
            {buildInfo.branch !== null ? <AppInfoRow label={t('branch')} value={buildInfo.branch} /> : null}
          </dl>
          {canUseNotifications ? <PushNotificationsControl /> : null}
          {authSession !== undefined ? <UserManagementPanel session={authSession} /> : null}
          {onLogout !== undefined ? (
            <button className="app-info__close" type="button" onClick={onLogout}>
              {t('logout')}
            </button>
          ) : null}
          <button className="app-info__close" type="button" onClick={() => setIsOpen(false)}>
            {t('close')}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function AppInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

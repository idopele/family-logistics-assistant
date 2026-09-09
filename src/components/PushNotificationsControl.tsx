import { useEffect, useState } from 'react';
import { useUiPreferences } from '../i18n';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentDevicePushStatus,
  getDevicePushSupportStatus,
  sendPushTestNotification,
  type DevicePushStatus,
} from '../services/pushNotifications';

export function PushNotificationsControl() {
  const { language, t } = useUiPreferences();
  const [status, setStatus] = useState<DevicePushStatus>(() => getDevicePushSupportStatus());
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void getCurrentDevicePushStatus().then((nextStatus) => {
      if (isCurrent) {
        setStatus(nextStatus);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function runAction(action: () => Promise<DevicePushStatus | void>, successMessage: string) {
    setIsBusy(true);
    setMessage(null);

    try {
      const nextStatus = await action();

      if (nextStatus !== undefined) {
        setStatus(nextStatus);
      }

      setMessage(successMessage);
    } catch {
      setMessage(t('pushActionFailed'));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="push-notifications" aria-label={t('notificationsOnThisDevice')}>
      <div className="push-notifications__header">
        <h3>{t('notificationsOnThisDevice')}</h3>
        <span data-status={status}>{getStatusLabel(status, t)}</span>
      </div>
      {status === 'unsupported' ? <p>{t('pushUnsupported')}</p> : null}
      {status === 'permission-denied' ? <p>{t('pushPermissionDeniedHelp')}</p> : null}
      <div className="push-notifications__actions">
        <button
          type="button"
          disabled={isBusy || status === 'enabled' || status === 'unsupported' || status === 'permission-denied'}
          onClick={() => void runAction(() => enablePushNotifications(language), t('pushEnabledMessage'))}
        >
          {t('enableNotifications')}
        </button>
        <button
          type="button"
          disabled={isBusy || status !== 'enabled'}
          onClick={() => void runAction(() => disablePushNotifications(), t('pushDisabledMessage'))}
        >
          {t('disableNotifications')}
        </button>
        <button
          type="button"
          disabled={isBusy || status !== 'enabled'}
          onClick={() => void runAction(() => sendPushTestNotification(language), t('pushTestSentMessage'))}
        >
          {t('sendTestNotification')}
        </button>
      </div>
      {message !== null ? <p className="push-notifications__message">{message}</p> : null}
    </section>
  );
}

function getStatusLabel(status: DevicePushStatus, t: (key: 'pushNotEnabled' | 'pushEnabled' | 'pushPermissionDenied' | 'pushUnsupportedState') => string): string {
  switch (status) {
    case 'enabled':
      return t('pushEnabled');
    case 'permission-denied':
      return t('pushPermissionDenied');
    case 'unsupported':
      return t('pushUnsupportedState');
    case 'not-enabled':
      return t('pushNotEnabled');
  }
}

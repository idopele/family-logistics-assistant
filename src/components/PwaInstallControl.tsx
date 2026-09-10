import { useEffect, useState } from 'react';
import { useUiPreferences } from '../i18n';
import {
  getCurrentInstallEnvironment,
  loadInstallPromptDismissed,
  saveInstallPromptDismissed,
  shouldShowInstallButton,
  shouldShowIosInstallGuidance,
  type BrowserInstallPromptEvent,
} from '../services/pwaInstall';

interface PwaInstallControlProps {
  defaultPromptEvent?: BrowserInstallPromptEvent | null;
  defaultDismissed?: boolean;
  defaultShowIosGuidance?: boolean;
}

export function PwaInstallControl({
  defaultPromptEvent = null,
  defaultDismissed,
  defaultShowIosGuidance,
}: PwaInstallControlProps) {
  const { t } = useUiPreferences();
  const [promptEvent, setPromptEvent] = useState<BrowserInstallPromptEvent | null>(defaultPromptEvent);
  const [isDismissed, setIsDismissed] = useState(() => defaultDismissed ?? loadInstallPromptDismissed());
  const [showIosGuidance, setShowIosGuidance] = useState(
    () => defaultShowIosGuidance ?? shouldShowIosInstallGuidance(getCurrentInstallEnvironment(), isDismissed),
  );
  const canInstall = shouldShowInstallButton(promptEvent, isDismissed);

  useEffect(() => {
    setShowIosGuidance(defaultShowIosGuidance ?? shouldShowIosInstallGuidance(getCurrentInstallEnvironment(), isDismissed));
  }, [defaultShowIosGuidance, isDismissed]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BrowserInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!canInstall && !showIosGuidance) {
    return null;
  }

  function dismiss() {
    setIsDismissed(true);
    setPromptEvent(null);
    setShowIosGuidance(false);
    saveInstallPromptDismissed();
  }

  async function promptInstall() {
    if (promptEvent === null) {
      return;
    }

    await promptEvent.prompt();
    dismiss();
  }

  return (
    <div className="pwa-install">
      {canInstall ? (
        <button className="pwa-install__button" type="button" onClick={() => void promptInstall()}>
          {t('installApp')}
        </button>
      ) : (
        <span className="pwa-install__guidance">{t('iosInstallGuidance')}</span>
      )}
      <button className="pwa-install__dismiss" type="button" aria-label={t('dismissInstallPrompt')} onClick={dismiss}>
        ×
      </button>
    </div>
  );
}

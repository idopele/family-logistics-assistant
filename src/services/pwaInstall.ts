export const pwaInstallDismissedStorageKey = 'family-logistics-pwa-install-dismissed-v1';

export interface BrowserInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export interface InstallEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
}

export function loadInstallPromptDismissed(storage: Pick<Storage, 'getItem'> | undefined = getBrowserStorage()): boolean {
  return storage?.getItem(pwaInstallDismissedStorageKey) === 'true';
}

export function saveInstallPromptDismissed(
  storage: Pick<Storage, 'setItem'> | undefined = getBrowserStorage(),
  isDismissed = true,
): void {
  storage?.setItem(pwaInstallDismissedStorageKey, isDismissed ? 'true' : 'false');
}

export function shouldShowInstallButton(promptEvent: BrowserInstallPromptEvent | null, isDismissed: boolean): boolean {
  return promptEvent !== null && !isDismissed;
}

export function shouldShowIosInstallGuidance(environment: InstallEnvironment, isDismissed: boolean): boolean {
  return isLikelyIos(environment) && !environment.standalone && !isDismissed;
}

export function getCurrentInstallEnvironment(): InstallEnvironment {
  const navigatorLike = typeof navigator === 'undefined' ? null : navigator;

  return {
    userAgent: navigatorLike?.userAgent ?? '',
    platform: navigatorLike?.platform ?? '',
    maxTouchPoints: navigatorLike?.maxTouchPoints ?? 0,
    standalone: isStandaloneDisplayMode() || isIosNavigatorStandalone(),
  };
}

function isLikelyIos(environment: InstallEnvironment): boolean {
  return (
    /iPad|iPhone|iPod/i.test(environment.userAgent) ||
    (environment.platform === 'MacIntel' && environment.maxTouchPoints > 1)
  );
}

function isStandaloneDisplayMode(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
}

function isIosNavigatorStandalone(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function getBrowserStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

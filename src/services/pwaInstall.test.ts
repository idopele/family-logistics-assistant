import { describe, expect, it } from 'vitest';

import {
  loadInstallPromptDismissed,
  pwaInstallDismissedStorageKey,
  saveInstallPromptDismissed,
  shouldShowInstallButton,
  shouldShowIosInstallGuidance,
  type BrowserInstallPromptEvent,
} from './pwaInstall';

const promptEvent = { prompt: async () => undefined } as BrowserInstallPromptEvent;

describe('PWA install helpers', () => {
  it('shows install UI only when browser install is available and not dismissed', () => {
    expect(shouldShowInstallButton(promptEvent, false)).toBe(true);
    expect(shouldShowInstallButton(null, false)).toBe(false);
    expect(shouldShowInstallButton(promptEvent, true)).toBe(false);
  });

  it('persists install prompt dismissal without touching other app storage', () => {
    const storage = new MemoryStorage();

    expect(loadInstallPromptDismissed(storage)).toBe(false);
    saveInstallPromptDismissed(storage);

    expect(loadInstallPromptDismissed(storage)).toBe(true);
    expect(storage.getItem(pwaInstallDismissedStorageKey)).toBe('true');
  });

  it('shows iOS guidance only for non-standalone iPhone or iPad-like devices', () => {
    expect(
      shouldShowIosInstallGuidance(
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5, standalone: false },
        false,
      ),
    ).toBe(true);
    expect(
      shouldShowIosInstallGuidance(
        { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0, standalone: false },
        false,
      ),
    ).toBe(false);
    expect(
      shouldShowIosInstallGuidance(
        { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', platform: 'iPad', maxTouchPoints: 5, standalone: true },
        false,
      ),
    ).toBe(false);
  });
});

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

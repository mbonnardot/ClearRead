import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';
import {
  getSettings,
  sanitizeSettings,
  subscribeSettings,
  updateSettings
} from '../../src/shared/storage';

describe('shared profiles & storage contract', () => {
  let store: Record<string, unknown>;
  let changeListeners: Array<
    (changes: Record<string, chrome.storage.StorageChange>, area: string) => void
  >;

  beforeEach(() => {
    store = {};
    changeListeners = [];
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((defaults: Record<string, unknown>, cb: (res: Record<string, unknown>) => void) => {
            cb({ ...defaults, ...store });
          }),
          set: vi.fn((patch: Record<string, unknown>, cb?: () => void) => {
            const changes: Record<string, chrome.storage.StorageChange> = {};
            for (const [key, value] of Object.entries(patch)) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
            cb?.();
            for (const listener of changeListeners) {
              listener(changes, 'sync');
            }
          })
        },
        onChanged: {
          addListener: vi.fn((fn) => changeListeners.push(fn)),
          removeListener: vi.fn((fn) => {
            changeListeners = changeListeners.filter((l) => l !== fn);
          })
        }
      }
    });
  });

  it('defines three calibrated immutable profiles matching spec defaults', () => {
    expect(PROFILES.mild).toEqual({
      enabled: true,
      profile: 'mild',
      font: 'Lexend',
      lineHeight: '1.65',
      letterSpacing: '0.04em',
      wordSpacing: '0.10em',
      tintColor: '#FFFFFF',
      rulerEnabled: false,
      ttsMode: 'off'
    });
    expect(PROFILES.moderate.ttsMode).toBe('alt-click');
    expect(PROFILES.heavy.ttsMode).toBe('click');
    expect(DEFAULT_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.hasSeenOnboarding).toBe(false);
  });

  it('sanitizes invalid stored values back to safe defaults', () => {
    const cleaned = sanitizeSettings({
      enabled: 'invalid',
      profile: 'unknown',
      font: 'Comic Sans',
      lineHeight: '1.5px',
      tintColor: '#000000',
      ttsMode: 'scream'
    });
    expect(cleaned).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ lineHeight: 1.5 }).lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
    expect(sanitizeSettings({ lineHeight: '99' }).lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
  });

  it('reads, updates immutably, and notifies subscribers on sync changes', async () => {
    const snapshots: unknown[] = [];
    const unsubscribe = subscribeSettings((next) => snapshots.push(next));

    const initial = await getSettings();
    expect(initial).toEqual(DEFAULT_SETTINGS);

    const updated = await updateSettings({ enabled: true, font: 'Lexend' });
    expect(updated.enabled).toBe(true);
    expect(updated.font).toBe('Lexend');
    expect(initial.enabled).toBe(false);
    expect(snapshots).toHaveLength(1);

    unsubscribe();
    await updateSettings({ rulerEnabled: true });
    expect(snapshots).toHaveLength(1);
  });
});

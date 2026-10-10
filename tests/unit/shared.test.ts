import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';
import {
  getSettings,
  isDomainExcluded,
  sanitizeSettings,
  subscribeSettings,
  updateSettings
} from '../../src/shared/storage';

describe('shared v2 schema, profiles, storage validators & offline assets', () => {
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

  it('defines three calibrated deeply-frozen v2 profiles and enabled DEFAULT_SETTINGS', () => {
    expect(Object.isFrozen(PROFILES)).toBe(true);
    expect(Object.isFrozen(PROFILES.mild)).toBe(true);
    expect(Object.isFrozen(PROFILES.moderate)).toBe(true);
    expect(Object.isFrozen(PROFILES.heavy)).toBe(true);

    expect(PROFILES.mild).toEqual({
      enabled: true,
      profile: 'mild',
      font: 'Lexend',
      fontScale: 100,
      lineHeight: '1.65',
      letterSpacing: '0.02em',
      wordSpacing: '0.06em',
      tintColor: '#FFFFFF',
      rulerEnabled: false,
      rulerStyle: 'narrow',
      bionicReading: false,
      syllableDots: false,
      paragraphAlternation: false,
      ttsMode: 'off',
      ttsRate: 1,
      excludedDomains: []
    });

    expect(PROFILES.moderate).toEqual({
      enabled: true,
      profile: 'moderate',
      font: 'Atkinson Hyperlegible',
      fontScale: 105,
      lineHeight: '1.8',
      letterSpacing: '0.05em',
      wordSpacing: '0.12em',
      tintColor: '#FBF0D9',
      rulerEnabled: true,
      rulerStyle: 'medium',
      bionicReading: true,
      syllableDots: false,
      paragraphAlternation: true,
      ttsMode: 'alt-click',
      ttsRate: 1,
      excludedDomains: []
    });

    expect(PROFILES.heavy).toEqual({
      enabled: true,
      profile: 'heavy',
      font: 'OpenDyslexic',
      fontScale: 110,
      lineHeight: '2.0',
      letterSpacing: '0.08em',
      wordSpacing: '0.16em',
      tintColor: '#FFF7E6',
      rulerEnabled: true,
      rulerStyle: 'narrow',
      bionicReading: true,
      syllableDots: true,
      paragraphAlternation: true,
      ttsMode: 'click',
      ttsRate: 1,
      excludedDomains: []
    });

    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SETTINGS.excludedDomains)).toBe(true);
    expect(DEFAULT_SETTINGS).toEqual({
      ...PROFILES.moderate,
      hasSeenOnboarding: false
    });
  });

  it('strictly validates and sanitizes all v2 settings fields and freezes returned structures', () => {
    const cleaned = sanitizeSettings({
      enabled: 'invalid',
      profile: 'unknown',
      font: 'Comic Sans',
      fontScale: '105',
      lineHeight: '1.5px',
      letterSpacing: '2px',
      wordSpacing: '4px',
      tintColor: '#000000',
      rulerEnabled: 'yes',
      rulerStyle: 'huge',
      bionicReading: 1,
      syllableDots: null,
      paragraphAlternation: undefined,
      ttsMode: 'scream',
      ttsRate: 2.0,
      excludedDomains: 'example.com',
      hasSeenOnboarding: 'true'
    });
    expect(cleaned).toEqual(DEFAULT_SETTINGS);
    expect(Object.isFrozen(cleaned)).toBe(true);
    expect(Object.isFrozen(cleaned.excludedDomains)).toBe(true);

    // fontScale bounds (integer in [90, 140])
    expect(sanitizeSettings({ fontScale: 90 }).fontScale).toBe(90);
    expect(sanitizeSettings({ fontScale: 140 }).fontScale).toBe(140);
    expect(sanitizeSettings({ fontScale: 89 }).fontScale).toBe(DEFAULT_SETTINGS.fontScale);
    expect(sanitizeSettings({ fontScale: 141 }).fontScale).toBe(DEFAULT_SETTINGS.fontScale);
    expect(sanitizeSettings({ fontScale: 102.5 }).fontScale).toBe(DEFAULT_SETTINGS.fontScale);

    // rulerStyle enum
    for (const style of ['bar', 'narrow', 'medium', 'wide'] as const) {
      expect(sanitizeSettings({ rulerStyle: style }).rulerStyle).toBe(style);
    }

    // ttsRate enum
    for (const rate of [0.75, 1, 1.25, 1.5] as const) {
      expect(sanitizeSettings({ ttsRate: rate }).ttsRate).toBe(rate);
    }

    // boolean toggles
    const toggles = sanitizeSettings({
      bionicReading: false,
      syllableDots: true,
      paragraphAlternation: false
    });
    expect(toggles.bionicReading).toBe(false);
    expect(toggles.syllableDots).toBe(true);
    expect(toggles.paragraphAlternation).toBe(false);

    // excludedDomains normalization and immutability
    const rawDomains = ['  Example.COM ', '', '   ', 123, 'Sub.Domain.ORG'];
    const withDomains = sanitizeSettings({ excludedDomains: rawDomains });
    expect(withDomains.excludedDomains).toEqual(['example.com', 'sub.domain.org']);
    expect(Object.isFrozen(withDomains.excludedDomains)).toBe(true);
    rawDomains.push('mutated.com');
    expect(withDomains.excludedDomains).toEqual(['example.com', 'sub.domain.org']);

    // lineHeight bounds
    expect(sanitizeSettings({ lineHeight: 1.5 }).lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
    expect(sanitizeSettings({ lineHeight: '99' }).lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
  });

  it('checks exact normalized hostnames in isDomainExcluded', () => {
    const excluded = ['example.com', 'docs.google.com'];
    expect(isDomainExcluded('example.com', excluded)).toBe(true);
    expect(isDomainExcluded('  EXAMPLE.COM  ', excluded)).toBe(true);
    expect(isDomainExcluded('Docs.Google.Com', excluded)).toBe(true);
    expect(isDomainExcluded('sub.example.com', excluded)).toBe(false);
    expect(isDomainExcluded('', excluded)).toBe(false);
  });

  it('reads, updates immutably, and notifies subscribers on sync changes', async () => {
    const snapshots: unknown[] = [];
    const unsubscribe = subscribeSettings((next) => snapshots.push(next));

    const initial = await getSettings();
    expect(initial).toEqual(DEFAULT_SETTINGS);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial.excludedDomains)).toBe(true);

    const updated = await updateSettings({
      enabled: false,
      font: 'Lexend',
      fontScale: 120,
      rulerStyle: 'bar',
      ttsRate: 1.25,
      excludedDomains: ['  News.YCombinator.COM ']
    });
    expect(updated.enabled).toBe(false);
    expect(updated.font).toBe('Lexend');
    expect(updated.fontScale).toBe(120);
    expect(updated.rulerStyle).toBe('bar');
    expect(updated.ttsRate).toBe(1.25);
    expect(updated.excludedDomains).toEqual(['news.ycombinator.com']);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(updated.excludedDomains)).toBe(true);
    expect(initial.enabled).toBe(true);
    expect(snapshots).toHaveLength(1);

    for (const listener of changeListeners) {
      listener({}, 'local');
    }
    expect(snapshots).toHaveLength(1);

    unsubscribe();
    await updateSettings({ rulerEnabled: false });
    expect(snapshots).toHaveLength(1);
  });

  it('bundles offline pdf.worker.min.mjs in public/', () => {
    const workerPath = resolve(process.cwd(), 'public/pdf.worker.min.mjs');
    expect(existsSync(workerPath)).toBe(true);
    expect(statSync(workerPath).size).toBeGreaterThan(0);
  });
});

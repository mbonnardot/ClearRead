import { DEFAULT_SETTINGS } from './profiles';
import type { ClearReadSettings, FontFamily, ProfileKey, TintColor, TtsMode } from './types';

const VALID_PROFILES = new Set<ProfileKey>(['mild', 'moderate', 'heavy']);
const VALID_FONTS = new Set<FontFamily>(['Lexend', 'Atkinson Hyperlegible', 'OpenDyslexic']);
const VALID_TINTS = new Set<TintColor>(['#FFFFFF', '#FBF0D9', '#FFF7E6', '#EAEFE9']);
const VALID_TTS_MODES = new Set<TtsMode>(['off', 'alt-click', 'click']);

function isValidLineHeight(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const num = Number.parseFloat(val);
  return Number.isFinite(num) && num >= 1.2 && num <= 3.0;
}

function isValidEmSpacing(val: unknown): val is string {
  return typeof val === 'string' && /^\d+(\.\d+)?em$/.test(val);
}

export function sanitizeSettings(raw: Record<string, unknown>): ClearReadSettings {
  return Object.freeze({
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
    profile: VALID_PROFILES.has(raw.profile as ProfileKey)
      ? (raw.profile as ProfileKey)
      : DEFAULT_SETTINGS.profile,
    font: VALID_FONTS.has(raw.font as FontFamily)
      ? (raw.font as FontFamily)
      : DEFAULT_SETTINGS.font,
    lineHeight: isValidLineHeight(raw.lineHeight)
      ? raw.lineHeight
      : DEFAULT_SETTINGS.lineHeight,
    letterSpacing: isValidEmSpacing(raw.letterSpacing)
      ? raw.letterSpacing
      : DEFAULT_SETTINGS.letterSpacing,
    wordSpacing: isValidEmSpacing(raw.wordSpacing)
      ? raw.wordSpacing
      : DEFAULT_SETTINGS.wordSpacing,
    tintColor: VALID_TINTS.has(raw.tintColor as TintColor)
      ? (raw.tintColor as TintColor)
      : DEFAULT_SETTINGS.tintColor,
    rulerEnabled:
      typeof raw.rulerEnabled === 'boolean' ? raw.rulerEnabled : DEFAULT_SETTINGS.rulerEnabled,
    ttsMode: VALID_TTS_MODES.has(raw.ttsMode as TtsMode)
      ? (raw.ttsMode as TtsMode)
      : DEFAULT_SETTINGS.ttsMode,
    hasSeenOnboarding:
      typeof raw.hasSeenOnboarding === 'boolean'
        ? raw.hasSeenOnboarding
        : DEFAULT_SETTINGS.hasSeenOnboarding
  });
}

export function getSettings(): Promise<ClearReadSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ ...DEFAULT_SETTINGS }, (items) => {
      resolve(sanitizeSettings(items));
    });
  });
}

export async function updateSettings(
  patch: Partial<ClearReadSettings>
): Promise<ClearReadSettings> {
  const current = await getSettings();
  const next = sanitizeSettings({ ...current, ...patch });
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ ...next }, () => resolve());
  });
  return next;
}

export function subscribeSettings(listener: (next: ClearReadSettings) => void): () => void {
  const handleStorageChange = (
    _changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => {
    if (area !== 'sync') return;
    void getSettings().then(listener);
  };

  chrome.storage.onChanged.addListener(handleStorageChange);
  return () => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
  };
}

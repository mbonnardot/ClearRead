import { DEFAULT_SETTINGS } from './profiles';
import type {
  ClearReadSettings,
  FontFamily,
  ProfileKey,
  RulerStyle,
  TintColor,
  TtsMode,
  TtsRate
} from './types';

const VALID_PROFILES = new Set<ProfileKey>(['mild', 'moderate', 'heavy']);
const VALID_FONTS = new Set<FontFamily>(['Lexend', 'Atkinson Hyperlegible', 'OpenDyslexic']);
const VALID_TINTS = new Set<TintColor>(['#FFFFFF', '#FBF0D9', '#FFF7E6', '#EAEFE9']);
const VALID_RULER_STYLES = new Set<RulerStyle>(['bar', 'narrow', 'medium', 'wide']);
const VALID_TTS_MODES = new Set<TtsMode>(['off', 'alt-click', 'click']);
const VALID_TTS_RATES = new Set<TtsRate>([0.75, 1, 1.25, 1.5]);

function isValidFontScale(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 90 && val <= 140;
}

function isValidLineHeight(val: unknown): val is string {
  if (!(typeof val === 'string' && /^\d+(\.\d+)?$/.test(val))) return false;
  const num = Number.parseFloat(val);
  return Number.isFinite(num) && num >= 1.2 && num <= 3.0;
}

function isValidEmSpacing(val: unknown): val is string {
  return typeof val === 'string' && /^\d+(\.\d+)?em$/.test(val);
}

function sanitizeExcludedDomains(val: unknown): readonly string[] {
  if (!Array.isArray(val)) {
    return Object.freeze([...DEFAULT_SETTINGS.excludedDomains]);
  }
  const sanitizedDomains: string[] = [];
  for (const entry of val) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.trim().toLowerCase();
    if (normalized.length > 0 && !sanitizedDomains.includes(normalized)) {
      sanitizedDomains.push(normalized);
    }
  }
  return Object.freeze([...sanitizedDomains]);
}

export function isDomainExcluded(
  hostname: string,
  excludedDomains: readonly string[]
): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  return excludedDomains.includes(normalized);
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
    fontScale: isValidFontScale(raw.fontScale)
      ? raw.fontScale
      : DEFAULT_SETTINGS.fontScale,
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
    rulerStyle: VALID_RULER_STYLES.has(raw.rulerStyle as RulerStyle)
      ? (raw.rulerStyle as RulerStyle)
      : DEFAULT_SETTINGS.rulerStyle,
    bionicReading:
      typeof raw.bionicReading === 'boolean'
        ? raw.bionicReading
        : DEFAULT_SETTINGS.bionicReading,
    syllableDots:
      typeof raw.syllableDots === 'boolean' ? raw.syllableDots : DEFAULT_SETTINGS.syllableDots,
    paragraphAlternation:
      typeof raw.paragraphAlternation === 'boolean'
        ? raw.paragraphAlternation
        : DEFAULT_SETTINGS.paragraphAlternation,
    ttsMode: VALID_TTS_MODES.has(raw.ttsMode as TtsMode)
      ? (raw.ttsMode as TtsMode)
      : DEFAULT_SETTINGS.ttsMode,
    ttsRate: VALID_TTS_RATES.has(raw.ttsRate as TtsRate)
      ? (raw.ttsRate as TtsRate)
      : DEFAULT_SETTINGS.ttsRate,
    excludedDomains: sanitizeExcludedDomains(raw.excludedDomains),
    hasSeenOnboarding:
      typeof raw.hasSeenOnboarding === 'boolean'
        ? raw.hasSeenOnboarding
        : DEFAULT_SETTINGS.hasSeenOnboarding
  });
}

export function getSettings(): Promise<ClearReadSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        ...DEFAULT_SETTINGS,
        excludedDomains: [...DEFAULT_SETTINGS.excludedDomains]
      },
      (items) => {
        resolve(sanitizeSettings(items));
      }
    );
  });
}

export async function updateSettings(
  patch: Partial<ClearReadSettings>
): Promise<ClearReadSettings> {
  const current = await getSettings();
  const next = sanitizeSettings({ ...current, ...patch });
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set(
      {
        ...next,
        excludedDomains: [...next.excludedDomains]
      },
      () => resolve()
    );
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

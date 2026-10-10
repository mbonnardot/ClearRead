import type { ClearReadSettings, ProfileKey } from './types';

export type ProfilePreset = Omit<ClearReadSettings, 'hasSeenOnboarding'>;

export const PROFILES: Readonly<Record<ProfileKey, ProfilePreset>> = Object.freeze({
  mild: Object.freeze({
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
    excludedDomains: Object.freeze([])
  }),
  moderate: Object.freeze({
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
    excludedDomains: Object.freeze([])
  }),
  heavy: Object.freeze({
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
    excludedDomains: Object.freeze([])
  })
});

export const DEFAULT_SETTINGS: ClearReadSettings = Object.freeze({
  ...PROFILES.moderate,
  hasSeenOnboarding: false
});

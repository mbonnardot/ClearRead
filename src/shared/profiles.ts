import type { ClearReadSettings, ProfileKey } from './types';

export type ProfilePreset = Omit<ClearReadSettings, 'hasSeenOnboarding'>;

export const PROFILES: Readonly<Record<ProfileKey, ProfilePreset>> = Object.freeze({
  mild: Object.freeze({
    enabled: true,
    profile: 'mild',
    font: 'Lexend',
    lineHeight: '1.65',
    letterSpacing: '0.04em',
    wordSpacing: '0.10em',
    tintColor: '#FFFFFF',
    rulerEnabled: false,
    ttsMode: 'off'
  }),
  moderate: Object.freeze({
    enabled: true,
    profile: 'moderate',
    font: 'Atkinson Hyperlegible',
    lineHeight: '1.8',
    letterSpacing: '0.06em',
    wordSpacing: '0.14em',
    tintColor: '#FBF0D9',
    rulerEnabled: true,
    ttsMode: 'alt-click'
  }),
  heavy: Object.freeze({
    enabled: true,
    profile: 'heavy',
    font: 'OpenDyslexic',
    lineHeight: '2.0',
    letterSpacing: '0.08em',
    wordSpacing: '0.18em',
    tintColor: '#FFF7E6',
    rulerEnabled: true,
    ttsMode: 'click'
  })
});

export const DEFAULT_SETTINGS: ClearReadSettings = Object.freeze({
  ...PROFILES.moderate,
  enabled: false,
  hasSeenOnboarding: false
});

export type ProfileKey = 'mild' | 'moderate' | 'heavy';

export type FontFamily =
  | 'Lexend'
  | 'Atkinson Hyperlegible'
  | 'OpenDyslexic';

export type TintColor =
  | '#FFFFFF'
  | '#FBF0D9'
  | '#FFF7E6'
  | '#EAEFE9';

export type TtsMode = 'off' | 'alt-click' | 'click';

export interface ClearReadSettings {
  readonly enabled: boolean;
  readonly profile: ProfileKey;
  readonly font: FontFamily;
  readonly lineHeight: string;
  readonly letterSpacing: string;
  readonly wordSpacing: string;
  readonly tintColor: TintColor;
  readonly rulerEnabled: boolean;
  readonly ttsMode: TtsMode;
  readonly hasSeenOnboarding: boolean;
}

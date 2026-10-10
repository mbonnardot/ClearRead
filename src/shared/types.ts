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

export type RulerStyle = 'bar' | 'narrow' | 'medium' | 'wide';

export type TtsMode = 'off' | 'alt-click' | 'click';

export type TtsRate = 0.75 | 1 | 1.25 | 1.5;

export interface ClearReadSettings {
  readonly enabled: boolean;
  readonly profile: ProfileKey;
  readonly font: FontFamily;
  readonly fontScale: number;
  readonly lineHeight: string;
  readonly letterSpacing: string;
  readonly wordSpacing: string;
  readonly tintColor: TintColor;
  readonly rulerEnabled: boolean;
  readonly rulerStyle: RulerStyle;
  readonly bionicReading: boolean;
  readonly syllableDots: boolean;
  readonly paragraphAlternation: boolean;
  readonly ttsMode: TtsMode;
  readonly ttsRate: TtsRate;
  readonly excludedDomains: readonly string[];
  readonly hasSeenOnboarding: boolean;
}

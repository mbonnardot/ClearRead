# ClearRead: Open-Source Dyslexia Reader Engine — Design Specification

**Date:** 2026-10-10  
**Status:** Draft (Pending User Spec Review)  
**Target Platform:** Chrome Extension (Manifest V3), TypeScript + Vite  

---

## 1. Executive Summary & Goals

Approximately 10% to 15% of readers experience dyslexia or visual/phonological reading fatigue. Modern websites exacerbate reading friction through narrow line spacing, justified alignment ("text rivers"), visual crowding, high-glare contrast, and lack of synchronized audio cues — while commercial accessibility extensions often require recurring subscriptions or inject tracking scripts.

**ClearRead** is an open-source, zero-cost, privacy-first Chrome Manifest V3 extension styled with **Material Design 3 (M3)** tokens. It runs 100% locally in the browser with bundled offline fonts, non-destructive CSS Custom Highlight API sentence/word tracking, and Shadow DOM overlays — requiring zero backend servers, zero accounts, and zero telemetry.

### Core Success Criteria
1. **Zero-Network Font Rendering:** Bundled `.woff2` files for **Lexend**, **Atkinson Hyperlegible**, and **OpenDyslexic** render offline in both extension pages and arbitrary host web pages without CDN requests.
2. **Guided 3-Tier Onboarding:** First-time install opens `onboarding.html` presenting three calibrated M3 reading profiles with an interactive live text preview.
3. **Layout-Safe Page Styling:** Prose typography (`p, li, dd, dt, blockquote`) adapts line height, spacing, alignment, and max line measure (`75ch`) without collapsing multi-column page containers (`main, section, article`), breaking icon fonts/code blocks, or causing unreadable low-contrast text on dark-mode websites.
4. **Non-Destructive Micro-TTS & Highlighting:** Sentence segmentation (`Intl.Segmenter`) paired with `CSS.highlights` highlights active sentences and words in place without mutating host DOM nodes or breaking links/React hydration, backed by an isolated Shadow DOM Pause/Stop floating pill.
5. **Automated Quality Gate:** ≥80% test coverage across Vitest unit tests and end-to-end Chromium Playwright tests.

---

## 2. Calibrated Reading Profiles & State Schema

### 2.1 Shared State Interface (`src/shared/types.ts`)

```ts
export type ProfileKey = 'mild' | 'moderate' | 'heavy';

export type FontFamily =
  | 'Lexend'
  | 'Atkinson Hyperlegible'
  | 'OpenDyslexic';

export type TintColor =
  | '#FFFFFF' // Clean White
  | '#FBF0D9' // Warm Parchment
  | '#FFF7E6' // Soft Peach
  | '#EAEFE9'; // Muted Sage

export type TtsMode =
  | 'off'       // Disabled
  | 'alt-click' // Trigger speech when Alt + clicking a prose element
  | 'click';    // Trigger speech on plain click of non-interactive prose text

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
```

### 2.2 Profile Presets (`src/shared/profiles.ts`)

| Profile (`ProfileKey`) | Display Name | Font | Line Height | Letter Spacing | Word Spacing | Paper Tint | Reading Ruler | Micro-TTS (`ttsMode`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `'mild'` | **Subtle Clarity** *(Mild / Fatigue)* | `Lexend` | `'1.65'` | `'0.04em'` | `'0.10em'` | `#FFFFFF` *(Clean White)* | `false` | `'off'` |
| `'moderate'` | **Focused Tracking** *(Moderate / Drift)* | `Atkinson Hyperlegible` | `'1.8'` | `'0.06em'` | `'0.14em'` | `#FBF0D9` *(Warm Parchment)* | `true` | `'alt-click'` |
| `'heavy'` | **Full Multi-Sensory** *(Severe / Phonological)* | `OpenDyslexic` | `'2.0'` | `'0.08em'` | `'0.18em'` | `#FFF7E6` *(Soft Peach)* | `true` | `'click'` |

**Initial Storage Default (`DEFAULT_SETTINGS`):**
Uses the `'moderate'` preset values with `enabled: false` and `hasSeenOnboarding: false` until the user selects a profile in Onboarding or toggles ClearRead on in the Popup.

---

## 3. System Architecture & File Organization

```
clearread/
├── public/
│   ├── manifest.json
│   ├── icon128.png
│   ├── fonts/
│   │   ├── Lexend-Regular.woff2
│   │   ├── AtkinsonHyperlegible-Regular.woff2
│   │   └── OpenDyslexic-Regular.woff2
│   └── styles/
│       ├── m3-theme.css        # Material Design 3 color, shape & elevation tokens
│       └── fonts.css           # Extension-page @font-face declarations
├── src/
│   ├── shared/
│   │   ├── types.ts            # TypeScript interfaces & literal union types
│   │   ├── profiles.ts         # Immutable PROFILES map + DEFAULT_SETTINGS
│   │   └── storage.ts          # Immutable chrome.storage.sync read/write/subscribe helpers
│   ├── background/
│   │   └── index.ts            # Service worker: launches onboarding.html on install
│   ├── content/
│   │   ├── index.ts            # Content script entry: coordinates state, styleEngine, overlayHost, ttsEngine
│   │   ├── styleEngine.ts      # Injects @font-face + scoped prose CSS, surface tint, CSS ::highlight rules
│   │   ├── overlayHost.ts      # Shadow DOM host for Reading Ruler + M3 Floating TTS Control Pill
│   │   ├── textMapper.ts       # Walks text nodes, segments sentences via Intl.Segmenter, builds DOM Ranges
│   │   └── ttsEngine.ts        # Web Speech controller + CSS.highlights synchronization + keyboard/pill controls
│   ├── onboarding/
│   │   ├── onboarding.html     # 3-card M3 setup flow + live preview box
│   │   └── index.ts            # Profile card selection, preview style updates, storage persistence
│   └── popup/
│       ├── popup.html          # M3 toolbar popup controls
│       └── index.ts            # Reactive two-way sync with chrome.storage.sync + recalibrate action
├── tests/
│   ├── unit/                   # Vitest + jsdom unit suites for shared, content, popup, and onboarding modules
│   └── e2e/                    # Playwright Chromium unpacked-extension integration tests
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 4. Component Design & Data Flow

### 4.1 Storage Synchronization (`src/shared/storage.ts`)
- `getSettings(): Promise<ClearReadSettings>` reads `chrome.storage.sync` merged over `DEFAULT_SETTINGS` and returns a fresh immutable object.
- `updateSettings(patch: Partial<ClearReadSettings>): Promise<ClearReadSettings>` validates keys and persists only defined changes to `chrome.storage.sync`.
- `subscribeSettings(listener: (next: ClearReadSettings) => void): () => void` listens to `chrome.storage.onChanged` for `'sync'` updates and emits a newly constructed `ClearReadSettings` snapshot to subscribers.

### 4.2 Content Script Style Engine (`src/content/styleEngine.ts`)
1. **Offline Font Injection (`<style id="clearread-fonts">`):**
   Injected once when ClearRead first activates on a tab, mapping `'Lexend'`, `'Atkinson Hyperlegible'`, and `'OpenDyslexic'` to `chrome.runtime.getURL('fonts/<file>.woff2')` with `font-display: swap`.
2. **Prose Typography & Surface Tint (`<style id="clearread-styles">`):**
   - **Prose Rules:** Targets `p, li, dd, dt, blockquote` with `font-family: '${font}', -apple-system, BlinkMacSystemFont, sans-serif !important`, configured `line-height`, `letter-spacing`, `word-spacing`, `text-align: left !important`, and `max-width: 75ch !important`. Structural containers (`main, section, article, div`) are intentionally excluded from `max-width` so CSS grids and sidebars never collapse.
   - **Exclusions:** `code, pre, kbd, samp, svg, i, [class*="icon"], [class*="fa-"]` retain `font-family: inherit !important; letter-spacing: normal !important`.
   - **Contrast-Safe Tinting:** When `tintColor !== '#FFFFFF'`, applies `background-color: ${tintColor} !important` to `html, body` and enforces `color: #1F1F1F !important` on prose elements (`p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6`) while keeping links readable (`a { color: #0B57D0 !important; }`), preventing invisible white-on-cream text on dark-mode websites.
   - **Highlight Pseudo-Elements:**
     - `::highlight(clearread-sentence)` — `background-color: rgba(26, 115, 232, 0.16); color: #1F1F1F;`
     - `::highlight(clearread-word)` — `background-color: rgba(251, 188, 4, 0.45); color: #1F1F1F;`
3. **Clean Teardown:** Disabling ClearRead removes `#clearread-styles`, unmounts the reading ruler, and stops active speech/highlights immediately.

### 4.3 Shadow DOM Overlays (`src/content/overlayHost.ts`)
Attaches a single `<div id="clearread-overlay-host">` appended to `document.documentElement` with an open `ShadowRoot` (`z-index: 2147483647`):
- **Reading Ruler (`#clearread-ruler`):** Full-viewport-width (`100vw`), `36px`-tall translucent warm highlight strip (`rgba(255, 255, 0, 0.18)` with `2px solid rgba(180, 150, 0, 0.35)` top/bottom borders, `pointer-events: none`), repositioned smoothly on passive `mousemove` events via `requestAnimationFrame`.
- **Floating TTS Control Pill (`#clearread-tts-pill`):** Compact M3 elevated surface chip pinned to `bottom: 20px; right: 20px` (visible only during active/paused TTS playback) containing:
  - Status label (`Reading…` / `Paused`)
  - **Pause / Resume** button (`aria-label="Pause reading"` / `"Resume reading"`)
  - **Stop** button (`aria-label="Stop reading"`)

### 4.4 Sentence Segmentation & Micro-TTS Engine (`src/content/textMapper.ts` & `src/content/ttsEngine.ts`)
1. **Trigger Rules:**
   - Ignored whenever `!settings.enabled` or `settings.ttsMode === 'off'`.
   - In `'alt-click'` mode: triggers only when `event.altKey === true`, calling `event.preventDefault()` to suppress default browser Alt-click behavior.
   - In `'click'` mode: triggers on plain primary clicks on prose elements (`p, li, dd, dt, blockquote, h1-h6`), **skipping** interactive ancestors (`a, button, input, select, textarea, summary, [role="button"]`) and non-collapsed text selections (`window.getSelection()?.isCollapsed === false`) unless `event.altKey` is held.
2. **Sentence & Character Mapping (`textMapper.ts`):**
   - Collects visible `Text` nodes within the target block using `TreeWalker` (`NodeFilter.SHOW_TEXT`), skipping hidden elements.
   - Segments full normalized text via `new Intl.Segmenter(document.documentElement.lang || 'en', { granularity: 'sentence' })`.
   - Builds an array of `SentenceSegment` objects (`{ text, startOffset, endOffset, range }`) plus a helper `createWordRange(segment, charIndex, charLength)` that resolves speech `boundary` offsets across multi-node inline elements (`<em>`, `<strong>`, `<a>`) into exact `Range` instances without DOM mutation.
3. **Speech Playback & Cleanup (`ttsEngine.ts`):**
   - Cancels any prior session before starting a new block.
   - Iterates through `SentenceSegment[]` sequentially at `utterance.rate = 0.95`.
   - Sets `CSS.highlights.set('clearread-sentence', new Highlight(segment.range))` when each sentence begins and updates `CSS.highlights.set('clearread-word', new Highlight(wordRange))` on `boundary` (`event.name === 'word'`) events.
   - Pressing `Escape`, clicking **Stop**, or toggling ClearRead off calls `speechSynthesis.cancel()`, clears `CSS.highlights`, and hides the floating TTS pill.

### 4.5 Extension UI Pages (`onboarding/` & `popup/`)
- **Onboarding (`src/onboarding/`):** Renders three selectable M3 cards (`mild`, `moderate`, `heavy`), updates `#previewBox` live with the selected profile's font, spacing, tint, and ruler border cue, and persists `{ ...PROFILES[selected], hasSeenOnboarding: true }` to `chrome.storage.sync` before closing the onboarding tab (`window.close()`, with fallback status message if opened directly in a standalone tab where `window.close()` is restricted).
- **Popup (`src/popup/`):** Hydrates controls from `chrome.storage.sync` (`enabled`, `font`, `rulerEnabled`, `lineHeight`, `tintColor`, `ttsMode`) and writes immutable updates immediately on `change`/`input`. Clicking *Recalibrate Profile* opens `onboarding.html` via `chrome.tabs.create`.

---

## 5. Build, Error Handling & Verification Plan

### 5.1 Vite MV3 Build (`vite.config.ts`)
- Compiles HTML entry points (`popup.html`, `onboarding.html`), service worker (`background.js`), and a self-contained IIFE content script (`content.js`) into `dist/` so `content_scripts` in Manifest V3 executes without dynamic chunk import restrictions.
- Copies static assets from `public/` (`manifest.json`, `icon128.png`, `fonts/*.woff2`, `styles/*.css`) directly into `dist/`.

### 5.2 Error Handling & Defensive Boundaries
- **Missing Web Speech API / Empty Voices:** Checks `'speechSynthesis' in window` before speaking; safely resolves or cleans up on `SpeechSynthesisErrorEvent` without uncaught rejections.
- **CSS Custom Highlight API Guard:** Checks `'highlights' in CSS` before registering `Highlight` objects so speech and the floating pill still work cleanly in test/older environments.
- **Invalid Storage Values:** `storage.ts` sanitizes stored values against allowed font, tint, numeric line-height (`1.4`–`2.4`), and `ttsMode` sets, falling back to `DEFAULT_SETTINGS` on unexpected input.

### 5.3 Testing Requirements (≥80% Coverage)
1. **Unit Tests (`vitest` + `jsdom`):**
   - `profiles.test.ts` & `storage.test.ts`: Preset immutability, default merging, input sanitization, storage change subscriptions.
   - `styleEngine.test.ts`: Font-face injection, prose CSS output, dark-mode contrast-safe ink colors, clean teardown.
   - `textMapper.test.ts`: Sentence splitting across nested inline DOM nodes (`<strong>`, `<a>`), word boundary `Range` resolution.
   - `ttsEngine.test.ts` & `overlayHost.test.ts`: Click vs `Alt+Click` filtering, interactive link exclusion, sentence/word highlight lifecycle, Pause/Resume/Stop pill actions, `Escape` cancellation.
   - `onboarding.test.ts` & `popup.test.ts`: Profile switching, preview updates, storage persistence.
2. **End-to-End Tests (`@playwright/test`):**
   - Launches headless/headed Chromium with `dist/` loaded unpacked; verifies onboarding profile apply flow, popup real-time updates on a test article page (including dark-mode contrast and grid preservation), reading ruler positioning, and click-to-speak sentence highlighting + Stop pill dismissal.

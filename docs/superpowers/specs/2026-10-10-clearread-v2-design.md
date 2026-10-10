# ClearRead v2 Architecture & Design Specification

**Date:** 2026-10-10  
**Project:** ClearRead — Best-in-Class Open-Source Dyslexia Web & PDF Reader Engine  
**Target Stack:** Chrome Manifest V3, TypeScript, Vite, `@mozilla/readability`, `pdfjs-dist`, Material Design 3, Vitest (`jsdom` + v8 ≥80%), Playwright Chromium E2E

---

## 1. Problem Statement & Goals

ClearRead v1 proved the zero-telemetry, bundled-font Material Design 3 Chrome extension baseline (`Lexend`, `Atkinson Hyperlegible`, `OpenDyslexic`, basic reading ruler, and click-to-speak Web Speech TTS). Real-world testing revealed three key opportunities to elevate ClearRead from a basic style injector into a best-in-class assistive reading suite:

1. **Eliminate Host-Page CSS Fragility:** Overriding container `background-color` and `color` directly on live web apps breaks dark mode, cards, buttons, and complex layouts, while narrow selector lists miss text inside modern `div`/`span` apps. ClearRead v2 separates **Non-Destructive In-Page Mode** (typography + return-sweep paragraph cues + viewport filter overlay, never breaking host backgrounds/colors) from a **Distraction-Free Reader View** powered by `@mozilla/readability`.
2. **Incorporate Best-in-Class Dyslexia & Focus Aids:** Integrate the top evidence-backed features from industry leaders (Microsoft Immersive Reader, Helperbird, Bionic Reading, BeeLine Reader, Speechify):
   - **Focus Mask Line Modes (`narrow` 1-line, `medium` 3-line, `wide` 5-line, plus `bar`)** with dimmed upper/lower viewport curtains (`rgba(18, 18, 22, 0.36)`) to prevent line skipping.
   - **Bionic Fixation Bolding (`bionicReading`)** bolding the initial fixation prefix (`~45%`) of each word to anchor eye saccades.
   - **Syllable Dots (`syllableDots`, e.g. `im·mer·sive`)** breaking multi-syllable words with centered middle dots (`·`) for effortless phonological decoding.
   - **Return-Sweep Paragraph Alternation (`paragraphAlternation`)** applying subtle alternating left accent borders and surface tinting per paragraph so readers never lose their place across line wraps.
   - **Granular Controls:** Font size scale (`90%–140%`), speech synthesis rate (`0.75x–1.5x`), and per-domain exclusion (`excludedDomains`).
3. **Full Accessible PDF Reader (`pdf.html` via `pdfjs-dist`):** Chrome's native PDF viewer blocks content-script DOM styling and speech range mapping. ClearRead v2 ships a dedicated offline-bundled `PDF.js` reader workspace supporting both web `.pdf` URLs (via an automatic `"Read in ClearRead"` pill on PDF tabs and Popup quick action) and local PDF files (via drag-and-drop / file picker), with seamless switching between **Reflowed Dyslexia Mode** and **Original Canvas + Text Layer Mode**.

---

## 2. Core Principles & Constraints

1. **Zero Telemetry & 100% Local Offline Assets:** All fonts (`.woff2`) and the `PDF.js` worker (`pdf.worker.min.mjs`) are copied from `node_modules` into `public/` via `scripts/prepare-assets.mjs`. Zero third-party CDNs, zero external network calls, zero analytics.
2. **Strict State Immutability:** All settings schemas (`ClearReadSettings`) and presets (`PROFILES`) are deeply `readonly` and `Object.freeze`d; updates return new shallow copies validated against strict schema guards in `src/shared/storage.ts`.
3. **Google Accessibility Rating (GAR) Compliance:**
   - Every interactive control across `popup.html`, `onboarding.html`, `pdf.html`, and the Reader View modal uses semantic HTML (`<button type="button">`, `<input>`, `<select>`) — zero clickable `<div>`s.
   - All dialogs (`<dialog id="clearread-reader-dialog">`) enforce `aria-modal="true"`, `aria-labelledby`, initial focus placement, `Tab`/`Shift+Tab` focus trapping, `Escape` / backdrop dismissal, and focus restoration to `lastActiveElement`.
   - High-contrast `:focus-visible` outlines (`2px solid #0B57D0`, `outline-offset: 2px`) across all surfaces.
4. **Dual Build Sync (`dist/` + Repo Root `/`):** `scripts/finalize-build.mjs` compiles and syncs all unpacked MV3 extension artifacts (`manifest.json`, `icon128.png`, `background.js`, `content.js`, `popup.html`, `onboarding.html`, `pdf.html`, `pdf.worker.min.mjs`, `assets/`, `fonts/`, `styles/`) to both `dist/` and `/` so loading unpacked works immediately after `git pull`.

---

## 3. Data Model (`src/shared/types.ts` & `src/shared/profiles.ts`)

```ts
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
  readonly fontScale: number; // 90 to 140 (percentage, step 5)
  readonly lineHeight: string; // '1.5' to '2.0'
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
```

### Updated Preset Profiles (`src/shared/profiles.ts`)

| Profile | Font | Font Scale | Line Height | Ruler / Focus Mask | Tint | Bionic / Syllables / Alternation | TTS Mode & Rate |
|---------|------|------------|-------------|--------------------|------|----------------------------------|-----------------|
| `mild` (*Subtle Clarity*) | `Lexend` | `100%` | `1.6` | Off (`narrow` when enabled) | `#FFFFFF` | Alternation `false`, Bionic `false`, Syllables `false` | `off` (`1.0x`) |
| `moderate` (*Focused Tracking*) | `Atkinson Hyperlegible` | `105%` | `1.8` | On (`medium` 3-line mask) | `#FBF0D9` | Alternation `true`, Bionic `true`, Syllables `false` | `alt-click` (`1.0x`) |
| `heavy` (*Multi-Sensory*) | `OpenDyslexic` | `110%` | `2.0` | On (`narrow` 1-line mask) | `#FBF0D9` | Alternation `true`, Bionic `true`, Syllables `true` | `click` (`1.0x`) |

---

## 4. Component Architecture

### 4.1 Non-Destructive In-Page Style Engine (`src/content/styleEngine.ts`)
- Injects `<style id="clearread-styles">` into `document.head` only when `settings.enabled === true` AND `window.location.hostname` is not in `settings.excludedDomains`.
- **Safe Typography Selectors:** Applies `font-family`, `line-height`, `letter-spacing`, and `word-spacing` to `p, p *:not(code):not(pre):not(kbd):not(samp):not(svg):not([class*="icon"]):not([class*="fa-"]), li, li *:not(code):not(pre):not(kbd):not(samp):not(svg):not([class*="icon"]):not([class*="fa-"]), dd, dt, blockquote, h1, h2, h3, h4, h5, h6, td, th, article > div, section > p`.
- **Font Scaling:** Applies `zoom: ${settings.fontScale / 100}` (when `fontScale !== 100`) strictly to leaf prose blocks (`p, li, dd, dt, blockquote`) so root grids/navbars never overflow.
- **Zero Host Background/Color Destruction:** Never overrides `background-color` or `color` on host containers (`main, section, article, div`), preserving dark mode, buttons, badges, and cards. Full-viewport paper tinting renders strictly via `#clearread-tint-layer` (`mix-blend-mode: multiply`).
- **Return-Sweep Paragraph Alternation (`paragraphAlternation: true`):** Styles `p:nth-of-type(even), li:nth-of-type(even), blockquote:nth-of-type(even)` with `border-left: 3px solid rgba(11, 87, 208, 0.45) !important; padding-left: 10px !important;` so the reader's eye clearly distinguishes adjacent blocks on line return sweeps without altering host backgrounds.
- **Multi-Node Range Highlight Pseudo-Elements:** Declares `::highlight(clearread-sentence)` and `::highlight(clearread-word)` for zero-DOM-mutation TTS tracking across both plain text and `<strong>` bionic nodes.

### 4.2 Focus Mask Ruler, Tint Filter & PDF Banner (`src/content/overlayHost.ts`)
Renders inside closed-isolated `<div id="clearread-overlay-host">` Shadow DOM:
1. **`#clearread-tint-layer`:** Fixed full-viewport `mix-blend-mode: multiply` tint layer (`#FBF0D9`, `#FFF7E6`, `#EAEFE9`).
2. **Focus Mask & Reading Ruler (`setRulerConfig(enabled: boolean, style: RulerStyle)`):**
   - `'bar'`: Classic soft highlight band (`height: 36px`, `rgba(255, 235, 59, 0.24)` with `rgba(11, 87, 208, 0.35)` border).
   - Focus Mask modes (`'narrow'` = `40px`, `'medium'` = `96px`, `'wide'` = `160px`): Renders two zero-latency upper/lower viewport curtains (`#clearread-mask-top` from `0` to `centerY - bandHeight / 2`, `#clearread-mask-bottom` from `centerY + bandHeight / 2` to `100vh`) shaded with `rgba(18, 18, 22, 0.36)` and crisp accent hairlines (`border-bottom` / `border-top: 1.5px solid rgba(11, 87, 208, 0.5)`), leaving the active reading band crystal-clear.
3. **Floating TTS Pill (`#clearread-tts-pill`):** Material Design 3 pill (`Pause` / `Resume` / `Stop`) stopping click propagation cleanly.
4. **PDF Detection Banner (`#clearread-pdf-banner`):** Automatically detects PDF documents (`location.pathname.toLowerCase().endsWith('.pdf')` or `document.contentType === 'application/pdf'` or `<embed type="application/pdf">`) and displays a top-right M3 elevated button `"📖 Read PDF in ClearRead"` that opens `chrome.runtime.getURL('pdf.html') + '?url=' + encodeURIComponent(location.href)`.

### 4.3 Shared Dyslexia Text Enricher (`src/shared/textTransforms.ts`)
Pure, idempotent DOM and string transformations shared by **Reader View** (`src/content/readerView.ts`) and **PDF Reflow** (`src/pdf/index.ts`):
- **`syllabifyWord(word: string): string` & `syllabifyText(text: string): string`:**
  - Deterministic English vowel-group / consonant-cluster splitter for alphabetic tokens of length `>= 6` (e.g., `immersive` → `im·mer·sive`, `dyslexia` → `dys·lex·ia`, `comprehension` → `com·pre·hen·sion`), preserving leading/trailing punctuation and case.
- **`renderEnrichedParagraphContent(container: HTMLElement, rawText: string, options: { bionic: boolean; syllables: boolean }): void` & `enrichHtmlFragment(root: ParentNode, options: { bionic: boolean; syllables: boolean }): void`:**
  - Safely processes `Text` nodes inside prose containers without using `innerHTML` string concatenation (preventing any XSS vectors).
  - Applies `syllabifyText` first when `syllables` is enabled, then splits word tokens so the first `Math.ceil(letterCount * 0.45)` characters of each word are rendered inside `<strong class="cr-bionic">` followed by a `Text` node for the suffix.
  - Multi-node `Range` resolution in `src/content/textMapper.ts` (`createWordRange` upgraded to resolve start/end across adjacent `Text` nodes inside a sentence segment) ensures CSS Custom Highlights (`::highlight(clearread-word)`) highlight entire words seamlessly even when `<strong>` splits a word across two `Text` nodes!

### 4.4 Distraction-Free Reader View (`src/content/readerView.ts`)
- Triggered from the Popup (`chrome.tabs.sendMessage(tabId, { type: 'CLEARREAD_TOGGLE_READER' })`) or keyboard shortcut (`Alt+R`).
- Clone-parses `document.cloneNode(true)` using `@mozilla/readability` (`new Readability(docClone).parse()`), falling back gracefully to `<article>` or `<main>` prose paragraphs if Readability returns `null`.
- Sanitizes extracted HTML via a strict allowlist DOM walker (`p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, code, strong, em, b, i, a, figure, figcaption, table, thead, tbody, tr, th, td, img, br`), stripping all `<script>`, `<style>`, `<iframe>`, event attributes (`on*`), and `javascript:` URLs.
- Renders inside `<dialog id="clearread-reader-dialog" aria-modal="true" aria-labelledby="clearread-reader-title">` inside Shadow DOM:
  - Sticky top toolbar with quick toggles (`Bionic`, `Syllables`, `Ruler`, `Tint`, `Font Size -/+`, `Read Aloud`, and `✕ Close`).
  - Applies full paper surface tint (`#FFFFFF`, `#FBF0D9`, `#FFF7E6`, `#EAEFE9`) with WCAG AAA `#1F1F1F` ink, user font, `fontScale`, `lineHeight`, `paragraphAlternation`, `bionicReading`, `syllableDots`, and click/button `TtsEngine` playback.
  - Full GAR focus management (`lastActiveElement` capture/restore, `Tab`/`Shift+Tab` trap, `Escape` & backdrop click dismissal).

### 4.5 Accessible `PDF.js` Workspace (`src/pdf/pdf.html` & `src/pdf/index.ts`)
- Dedicated extension page bundled via Vite (`pdf: resolve(__dirname, 'src/pdf/pdf.html')`), configuring `GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs')`.
- **Dual Input Sources:**
  1. **Web URL (`?url=https://.../file.pdf`):** Fetches PDF bytes (`fetch(pdfUrl)`) and loads `getDocument({ data })`.
  2. **Local File Picker / Drag-and-Drop:** Full-card accessible M3 empty-state dropzone + toolbar `"Open Local PDF"` button (`<input id="pdfFileInput" type="file" accept="application/pdf">`) reading `ArrayBuffer` client-side.
- **Two Switchable Reading Modes:**
  1. **Reflowed Dyslexia Mode (`#modeReflowBtn`, default):** Extracts text items per page via `page.getTextContent()`, reconstructs natural paragraphs by line Y-delta & vertical gaps, and renders semantic `<section class="pdf-reflow-page">` cards styled with live `ClearReadSettings` (`font`, `fontScale`, `lineHeight`, `tintColor`, `bionicReading`, `syllableDots`, `paragraphAlternation`, `Focus Mask`, and `TtsEngine` with `ttsRate`).
  2. **Original Canvas + Text Layer Mode (`#modeCanvasBtn`):** Renders high-DPI `<canvas>` pages alongside positioned transparent text spans so layout-heavy tables/diagrams stay intact while keeping Focus Mask ruler and click-to-speak active.

---

## 5. Verification Strategy

1. **Unit & Component Tests (`npx vitest run` / `npm run test:coverage`, ≥80% across all metrics):**
   - `tests/unit/shared.test.ts`: New v2 schema defaults, validators (`isValidRulerStyle`, `isValidFontScale`, `isValidTtsRate`, `isValidExcludedDomains`, `isDomainExcluded`), profile definitions.
   - `tests/unit/textTransforms.test.ts`: `syllabifyWord`, `syllabifyText`, `enrichHtmlFragment` (`bionicReading` + `syllableDots` + XSS safety + idempotent re-render).
   - `tests/unit/styleEngine.test.ts`: Non-destructive host rules, `excludedDomains` skip behavior, `fontScale` zoom, `paragraphAlternation` CSS rules.
   - `tests/unit/overlayHost.test.ts`: `bar` vs `narrow`/`medium`/`wide` Focus Mask curtains, PDF URL detection pill rendering & click navigation.
   - `tests/unit/readerView.test.ts`: `@mozilla/readability` article extraction, HTML sanitization, Bionic/Syllable live toggles, GAR focus trap & restore.
   - `tests/unit/pdfViewer.test.ts`: Paragraph reconstruction from `PDF.js` text items, Reflow vs Canvas mode switching, Bionic/Syllable/TTS integration.
   - `tests/unit/ui.test.ts`: Popup GAR `<button>` semantics, per-site toggle (`excludedDomains`), sliders/toggles, Reader View & PDF triggers.
2. **End-to-End Unpacked Extension Tests (`npm run test:e2e` via Playwright Chromium):**
   - Load unpacked extension from `dist/`.
   - Verify non-destructive styling on a dark-mode/card-rich page + Focus Mask curtains (`medium` / `narrow`) + opening **Reader View** (`#clearread-reader-dialog`) with Bionic Reading & Syllable Dots active.
   - Open `pdf.html` with a generated multi-paragraph test PDF (via `?url=https://clearread.test/sample.pdf`), verifying automatic extraction in **Reflowed Dyslexia Mode** with `OpenDyslexic`, Bionic Fixation Bolding, Syllable Dots, and canvas view toggle.

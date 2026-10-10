# ClearRead v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ClearRead v2 with a non-destructive dual-mode Web Reader Engine (`@mozilla/readability` Reader View + live Focus Mask curtains, Bionic Fixation Bolding, Syllable Dots, Return-Sweep Paragraph Alternation) and a full offline-bundled `PDF.js` accessible reader (`pdf.html`).

**Architecture:** Manifest V3 TypeScript Chrome extension bundled with Vite into `dist/` and synced to repo root `/` via `scripts/finalize-build.mjs`. Host web pages get safe non-destructive CSS typography + viewport overlays (`styleEngine.ts` + `overlayHost.ts`), while isolated surfaces (`readerView.ts` `<dialog>` modal and `pdf.html` `PDF.js` viewer) apply full paper background tints and shared text enrichments (`src/shared/textTransforms.ts`).

**Tech Stack:** TypeScript, Vite, Chrome Extension Manifest V3, `@mozilla/readability`, `pdfjs-dist`, Material Design 3, Vitest (`jsdom` + `@vitest/coverage-v8`), Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-10-10-clearread-v2-design.md`

## Global Constraints

- Zero network telemetry, zero analytics, and zero third-party CDNs: all fonts (`Lexend`, `Atkinson Hyperlegible`, `OpenDyslexic`) and `pdf.worker.min.mjs` are copied locally from `node_modules` into `public/`.
- Strict immutability (`Object.freeze` / shallow copies) across all state and configuration objects (`ClearReadSettings`, `PROFILES`).
- Google Accessibility Rating (GAR) Web Compliance: all interactive elements use native `<button type="button">`, `<input>`, or `<select>`; all modal dialogs (`<dialog id="clearread-reader-dialog">`) enforce `aria-modal="true"`, `aria-labelledby`, focus trapping (`Tab`/`Shift+Tab`), `Escape`/backdrop close, and focus restoration to `lastActiveElement`.
- Non-destructive host CSS: `styleEngine.ts` never overrides `background-color` or `color` on host containers (`div, section, article, main`); full paper tints apply on `#clearread-tint-layer` (`mix-blend-mode: multiply`), Reader View, and `pdf.html`.
- Minimum unit test coverage: `80%+` across statements, branches, functions, and lines in Vitest (`npm run test:coverage`), plus green unpacked Chromium Playwright E2E tests (`npm run test:e2e`).
- Build artifacts synced to both `dist/` and repository root `/` via `scripts/finalize-build.mjs` so unpacked loading works out of the box from a fresh clone.

---

### Task 1: Dependencies, Offline Assets & Shared v2 Schema

**Files:**
- Modify: `package.json`
- Modify: `scripts/prepare-assets.mjs`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/profiles.ts`
- Modify: `src/shared/storage.ts`
- Modify: `tests/unit/shared.test.ts`

**Interfaces:**
- Produces:
  - `RulerStyle = 'bar' | 'narrow' | 'medium' | 'wide'`
  - `TtsRate = 0.75 | 1 | 1.25 | 1.5`
  - `ClearReadSettings` (`enabled`, `profile`, `font`, `fontScale`, `lineHeight`, `letterSpacing`, `wordSpacing`, `tintColor`, `rulerEnabled`, `rulerStyle`, `bionicReading`, `syllableDots`, `paragraphAlternation`, `ttsMode`, `ttsRate`, `excludedDomains`, `hasSeenOnboarding`)
  - `PROFILES: Readonly<Record<ProfileKey, Omit<ClearReadSettings, 'enabled' | 'profile' | 'excludedDomains' | 'hasSeenOnboarding'>>>`
  - `DEFAULT_SETTINGS: ClearReadSettings`
  - `loadSettings(): Promise<ClearReadSettings>`, `saveSettings(partial: Partial<ClearReadSettings>): Promise<ClearReadSettings>`, `subscribeToSettings(cb: (next: ClearReadSettings) => void): () => void`
  - `isDomainExcluded(hostname: string, excludedDomains: readonly string[]): boolean`

- [ ] **Step 1: Install `@mozilla/readability` and `pdfjs-dist` and update `scripts/prepare-assets.mjs`**
  - Run `npm install @mozilla/readability pdfjs-dist`
  - Update `scripts/prepare-assets.mjs` to copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` -> `public/pdf.worker.min.mjs` alongside `.woff2` fonts and `icon128.png`.
  - Run `npm run prepare-assets` and confirm `public/pdf.worker.min.mjs` exists.
- [ ] **Step 2: Write failing v2 schema & storage tests in `tests/unit/shared.test.ts`**
  - Test default settings (`fontScale: 105`, `rulerStyle: 'medium'`, `bionicReading: true`, `syllableDots: false`, `paragraphAlternation: true`, `ttsRate: 1`, `excludedDomains: []`), `PROFILES`, validation fallback for out-of-range `fontScale`/`ttsRate`/`rulerStyle`/`excludedDomains`, and `isDomainExcluded`.
- [ ] **Step 3: Run `npx vitest run tests/unit/shared.test.ts` to verify RED failure**
- [ ] **Step 4: Implement `src/shared/types.ts`, `src/shared/profiles.ts`, and `src/shared/storage.ts`**
  - Enforce `Object.freeze` on returned settings and `excludedDomains` arrays.
- [ ] **Step 5: Run `npx vitest run tests/unit/shared.test.ts` to verify GREEN pass and commit**

---

### Task 2: Dyslexia Text Enricher, Multi-Node Range Mapper & Speech Rate Controller

**Files:**
- Create: `src/shared/textTransforms.ts`
- Modify: `src/content/textMapper.ts`
- Modify: `src/content/ttsEngine.ts`
- Create: `tests/unit/textTransforms.test.ts`
- Modify: `tests/unit/textMapper.test.ts`
- Modify: `tests/unit/ttsEngine.test.ts`

**Interfaces:**
- Consumes: `TtsMode`, `TtsRate` from `src/shared/types.ts`
- Produces:
  - `syllabifyWord(word: string): string` & `syllabifyText(text: string): string` in `src/shared/textTransforms.ts`
  - `enrichElementText(root: ParentNode, options: { bionic: boolean; syllables: boolean }): void` in `src/shared/textTransforms.ts` (preserves original text via `data-cr-raw` on element containers, skips `script, style, pre, code, kbd, samp`, never uses `innerHTML`)
  - `extractSentenceSegments(container: Element): SentenceSegment[]` & multi-node `createWordRange(segment: SentenceSegment, charIndex: number): Range | null` in `src/content/textMapper.ts`
  - `TtsEngine.setRate(rate: TtsRate): void` in `src/content/ttsEngine.ts`

- [ ] **Step 1: Write failing tests in `tests/unit/textTransforms.test.ts`, `tests/unit/textMapper.test.ts`, and `tests/unit/ttsEngine.test.ts`**
  - Verify `syllabifyWord('immersive')` inserts `·` breaks cleanly (`im·mer·sive`), leaves short `<6`-letter words untouched, and preserves punctuation.
  - Verify `enrichElementText` wraps initial `Math.ceil(len * 0.45)` characters in `<strong class="cr-bionic">`, is idempotent across repeated invocations with toggled options, and resists HTML/script injection.
  - Verify `createWordRange` produces a single `Range` spanning across `<strong class="cr-bionic">Im</strong>mersive` so CSS Custom Highlights highlight the full word.
  - Verify `ttsEngine.setRate(1.25)` sets `utterance.rate === 1.25`.
- [ ] **Step 2: Run `npx vitest run tests/unit/textTransforms.test.ts tests/unit/textMapper.test.ts tests/unit/ttsEngine.test.ts` to verify RED failure**
- [ ] **Step 3: Implement `src/shared/textTransforms.ts`, multi-node `resolveBoundary` in `createWordRange` (`src/content/textMapper.ts`), and `setRate` in `src/content/ttsEngine.ts`**
- [ ] **Step 4: Run Vitest on all three suites to verify GREEN pass and commit**

---

### Task 3: Non-Destructive Style Engine & Focus Mask / PDF Banner Overlay

**Files:**
- Modify: `src/content/styleEngine.ts`
- Modify: `src/content/overlayHost.ts`
- Modify: `tests/unit/styleEngine.test.ts`
- Modify: `tests/unit/overlayHost.test.ts`

**Interfaces:**
- Consumes: `ClearReadSettings`, `RulerStyle`, `TintColor` from `src/shared/types.ts`; `isDomainExcluded` from `src/shared/storage.ts`
- Produces:
  - `applyStyles(settings: ClearReadSettings, hostname?: string): void` & `removeStyles(): void` in `src/content/styleEngine.ts`
  - `OverlayHost` with `setRulerConfig(enabled: boolean, style: RulerStyle): void` (plus backwards-compatible `setRulerEnabled(enabled: boolean): void`), `setTintColor(color: TintColor | null): void`, `setTtsState(state: TtsUiState): void`, `updatePdfBanner(isPdf: boolean, pdfUrl?: string): void`, `destroy(): void` in `src/content/overlayHost.ts`
  - `detectPdfPage(doc?: Document, loc?: Location): boolean` in `src/content/overlayHost.ts`

- [ ] **Step 1: Write failing tests in `tests/unit/styleEngine.test.ts` and `tests/unit/overlayHost.test.ts`**
  - Verify `applyStyles` NEVER injects `background-color` overrides on host elements (`main, section, article, div, body`), respects `excludedDomains`, applies `zoom` when `fontScale !== 100`, and adds `border-left` alternation rules when `paragraphAlternation: true`.
  - Verify `overlay.setRulerConfig(true, 'medium')` renders `#clearread-mask-top` and `#clearread-mask-bottom` curtains around a `96px` clear focus band and updates curtain geometry on `mousemove`, while `'bar'` renders `#clearread-ruler`.
  - Verify `detectPdfPage` and `overlay.updatePdfBanner(true, 'https://example.org/paper.pdf')` render `#clearread-pdf-banner` with accessible `<button type="button" id="clearread-open-pdf-btn">`.
- [ ] **Step 2: Run `npx vitest run tests/unit/styleEngine.test.ts tests/unit/overlayHost.test.ts` to verify RED failure**
- [ ] **Step 3: Implement `src/content/styleEngine.ts` and `src/content/overlayHost.ts`**
- [ ] **Step 4: Run `npx vitest run tests/unit/styleEngine.test.ts tests/unit/overlayHost.test.ts` to verify GREEN pass and commit**

---

### Task 4: Distraction-Free Reader View Modal (`@mozilla/readability`) & Content Orchestrator

**Files:**
- Create: `src/content/readerView.ts`
- Modify: `src/content/index.ts`
- Create: `tests/unit/readerView.test.ts`
- Modify: `tests/unit/ttsEngine.test.ts`

**Interfaces:**
- Consumes: `@mozilla/readability`, `ClearReadSettings` (`src/shared/types.ts`), `saveSettings` (`src/shared/storage.ts`), `enrichElementText` (`src/shared/textTransforms.ts`), `TtsEngine` (`src/content/ttsEngine.ts`)
- Produces:
  - `ReaderViewController` (`open(): boolean`, `close(): void`, `toggle(): boolean`, `isOpen(): boolean`, `updateSettings(settings: ClearReadSettings): void`, `getArticleRoot(): HTMLElement | null`, `destroy(): void`) in `src/content/readerView.ts`
  - Message listener in `src/content/index.ts` handling `{ type: 'CLEARREAD_TOGGLE_READER' }` and `Alt+R` shortcut, plus PDF banner initialization via `overlay.updatePdfBanner(...)`.

- [ ] **Step 1: Write failing tests in `tests/unit/readerView.test.ts` and `tests/unit/ttsEngine.test.ts`**
  - Verify `reader.open()` parses article content via `@mozilla/readability`, strips `<script>` and `onclick` attributes, applies paper tint background + `#1F1F1F` ink inside `#clearread-reader-dialog`, enriches paragraphs with Bionic Bolding & Syllable Dots when enabled, traps `Tab` focus inside modal controls, closes on `Escape` or backdrop click, and restores focus to `lastActiveElement`.
- [ ] **Step 2: Run `npx vitest run tests/unit/readerView.test.ts` to verify RED failure**
- [ ] **Step 3: Implement `src/content/readerView.ts` and wire into `src/content/index.ts`**
- [ ] **Step 4: Run `npx vitest run tests/unit/readerView.test.ts tests/unit/ttsEngine.test.ts` to verify GREEN pass and commit**

---

### Task 5: Accessible `PDF.js` Viewer Workspace (`pdf.html`) & GAR Popup / Onboarding Upgrade

**Files:**
- Create: `src/pdf/pdf.html`
- Create: `src/pdf/index.ts`
- Modify: `src/popup/popup.html`
- Modify: `src/popup/index.ts`
- Modify: `src/onboarding/onboarding.html`
- Modify: `src/onboarding/index.ts`
- Modify: `public/styles/m3-theme.css`
- Create: `tests/unit/pdfViewer.test.ts`
- Modify: `tests/unit/ui.test.ts`

**Interfaces:**
- Consumes: `pdfjs-dist`, `loadSettings`, `saveSettings`, `subscribeToSettings`, `isDomainExcluded`, `PROFILES`, `enrichElementText`, `OverlayHost`, `TtsEngine`
- Produces:
  - `reconstructParagraphsFromItems(items: ReadonlyArray<{ str: string; transform: readonly number[]; hasEOL?: boolean }>): string[]` and `initPdfViewer(deps?: PdfViewerDeps): Promise<void>` in `src/pdf/index.ts`
  - GAR-compliant Popup (`src/popup/popup.html`, `src/popup/index.ts`) and Onboarding (`src/onboarding/onboarding.html`, `src/onboarding/index.ts`) UIs with semantic `<button type="button">` cards, `Reader View` & `PDF Reader` quick actions, per-site toggle, `fontScale` slider, `rulerStyle` select, `bionicToggle`, `syllableToggle`, `alternationToggle`, and `ttsRateSelect`.

- [ ] **Step 1: Write failing tests in `tests/unit/pdfViewer.test.ts` and `tests/unit/ui.test.ts`**
  - Verify `reconstructParagraphsFromItems` merges same-line glyphs and close lines into clean paragraphs while splitting large vertical gaps into separate paragraphs.
  - Verify `initPdfViewer` loads a mocked/in-memory PDF document, renders Reflowed Dyslexia pages (`<section class="pdf-reflow-page">`) with Bionic Bolding & Syllable Dots, switches cleanly between `reflow` and `canvas` modes, and triggers TTS on paragraph clicks.
  - Verify Popup & Onboarding semantic `<button>` controls, per-site toggle updating `excludedDomains`, Reader View trigger sending `{ type: 'CLEARREAD_TOGGLE_READER' }`, and Open PDF button opening `pdf.html`.
- [ ] **Step 2: Run `npx vitest run tests/unit/pdfViewer.test.ts tests/unit/ui.test.ts` to verify RED failure**
- [ ] **Step 3: Implement `src/pdf/pdf.html`, `src/pdf/index.ts`, `src/popup/{popup.html,index.ts}`, `src/onboarding/{onboarding.html,index.ts}`, and `public/styles/m3-theme.css`**
- [ ] **Step 4: Run `npx vitest run` to verify all unit suites pass and commit**

---

### Task 6: Multi-Entry MV3 Build Sync, Documentation & End-to-End Unpacked Extension Verification

**Files:**
- Modify: `public/manifest.json`
- Modify: `vite.config.ts`
- Modify: `scripts/finalize-build.mjs`
- Modify: `README.md`
- Modify: `tests/e2e/extension.spec.ts`

**Interfaces:**
- Consumes: All extension entry points (`popup.html`, `onboarding.html`, `pdf.html`, `background.js`, `content.js`, `pdf.worker.min.mjs`)
- Produces: Complete unpacked Chrome MV3 bundles in both `dist/` and repository root `/`, ≥80% Vitest coverage across all metrics, and passing unpacked Chromium Playwright E2E suite covering Web Engine v2, Reader View, Focus Mask, and `PDF.js` Viewer.

- [ ] **Step 1: Update `public/manifest.json`, `vite.config.ts`, `scripts/finalize-build.mjs`, and `README.md`**
- [ ] **Step 2: Expand `tests/e2e/extension.spec.ts` to verify non-destructive dark-mode web styling + Focus Mask curtains, `@mozilla/readability` Reader View modal with Bionic & Syllables, and opening a real PDF in `pdf.html` Reflow + Canvas modes**
- [ ] **Step 3: Run `npx tsc --noEmit && npm run build && npm run test:coverage && npm run test:e2e`**
- [ ] **Step 4: Commit all source + built unpacked root & `dist/` artifacts**

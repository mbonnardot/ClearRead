# ClearRead v2 — Open-Source Dyslexia Web & PDF Reader

**ClearRead v2** is a free, zero-telemetry Material Design 3 Chrome Extension (Manifest V3) built for comfortable, distraction-free web and PDF reading. It bundles all accessibility fonts and `PDF.js` offline—never sending reading content or analytics over the network.

---

## Key Capabilities

1. **Dual-Mode Non-Destructive Web Engine**
   - **In-Page Mode (`src/content/styleEngine.ts`):** Enhances prose (`Lexend`, `Atkinson Hyperlegible`, `OpenDyslexic`), customizable font scaling (`90%–150%`), generous line/letter/word spacing, Return-Sweep Paragraph Alternation, and Shadow DOM `mix-blend-mode: multiply` paper tinting (`#clearread-tint-layer`) while strictly preserving host dark themes, badges, buttons, and multi-column grid layouts.
   - **Distraction-Free Reader View (`Alt+R` / Popup Trigger):** Extracts clean articles via `@mozilla/readability` into an isolated Shadow DOM modal (`<dialog id="clearread-reader-dialog">`) with full paper tint backgrounds, keyboard focus management, and live toggles.
2. **Competitive Dyslexia & Focus Aids**
   - **Focus Mask Line Modes:** Classic Tint Bar (`bar`) plus shaded viewport curtains (`#clearread-mask-top` / `#clearread-mask-bottom`) framing `narrow` (1-line), `medium` (3-line), or `wide` (5-line) reading windows.
   - **Bionic Fixation Bolding:** Highlights word prefixes (`<strong class="cr-bionic">`) to guide saccadic eye fixations.
   - **Syllable Dots (`im·mer·sive`):** Splits multisyllabic words with subtle interpuncts (`·`) for effortless decoding.
   - **Return-Sweep Paragraph Alternation:** Adds subtle left accent borders on alternating paragraphs to prevent line-skipping.
   - **Per-Site Exclusions:** Toggle ClearRead on or off per domain directly from the toolbar popup.
3. **Offline Accessible `PDF.js` Reader (`pdf.html`)**
   - Opens any web PDF URL (via floating `"📖 Read PDF in ClearRead"` pill on PDF tabs or the popup `"📄 PDF Reader"` button) or local PDF file (drag-and-drop / file picker).
   - **Reflowed Dyslexia Mode:** Reconstructs multi-line PDF paragraphs with full dyslexia fonts, Bionic bolding, Syllable dots, Focus Masks, paper tints, and click-to-read synchronized speech (`0.75x–1.5x`).
   - **Original Layout Mode:** Renders exact `PDF.js` page canvases alongside selectable text blocks.

---

## Install Unpacked in Chrome

Both the repository root (`/`) and `dist/` contain the complete built Manifest V3 extension:

```bash
npm install
npm run build
```

1. Open `chrome://extensions` in Chrome or Chromium.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select either the project root directory or `dist/`.

---

## Development & Verification Suite

```bash
# Typecheck strict TypeScript across src/ and tests/
npx tsc --noEmit

# Build standalone IIFE content script + multi-entry MV3 bundle (syncing root & dist/)
npm run build

# Run Vitest unit & integration test suite with v8 coverage (≥80% enforced)
npm run test:coverage

# Run Playwright Chromium unpacked extension E2E tests
npm run test:e2e
```

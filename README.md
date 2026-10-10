# ClearRead

ClearRead is an open-source Chrome Manifest V3 reading assistant built with Material Design 3 for dyslexic readers, visual fatigue relief, and focused comprehension. All typography assets are bundled offline with zero external runtime network requests.

## Features

- **Calibrated Reading Profiles**: Instant presets for varying reading needs:
  - **Subtle Clarity (`mild`)**: Generous vertical and horizontal spacing with **Lexend** typography.
  - **Focused Tracking (`moderate`)**: **Atkinson Hyperlegible** typography, warm paper tint (`#FBF0D9`), dynamic reading ruler, and `Alt + Click` text-to-speech.
  - **Multi-Sensory (`heavy`)**: Weighted **OpenDyslexic** characters, soft peach tint (`#FFF7E6`), dynamic reading ruler, and direct `Click` text-to-speech.
- **Bundled Offline Fonts**: Includes self-hosted `.woff2` files for `Lexend`, `Atkinson Hyperlegible`, and `OpenDyslexic`.
- **Non-Destructive Micro-TTS Highlighting**: Uses native `Intl.Segmenter` sentence/word range mapping and the CSS Custom Highlight API (`CSS.highlights`) to highlight spoken sentences and words without mutating page DOM structure.
- **Shadow DOM Overlay Isolation**: Renders the cursor-tracking reading ruler and floating Pause/Resume + Stop TTS control pill inside an isolated `#clearread-overlay-host` Shadow root.
- **Material Design 3 UI**: Keyboard-accessible onboarding flow (`onboarding.html`) with live typography preview and toolbar popup (`popup.html`) backed by immutable, schema-sanitized `chrome.storage.sync` persistence.

## Local Unpacked Chrome Setup

1. Install dependencies and build the extension bundle:

   ```bash
   npm install && npm run build
   ```

2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the generated `dist/` directory.

## Architecture

```text
src/
├── shared/
│   ├── types.ts        # Strict TypeScript interfaces and literal union types
│   ├── profiles.ts     # Immutable reading presets (mild, moderate, heavy) & defaults
│   └── storage.ts      # Sanitized chrome.storage.sync wrapper & change subscriptions
├── content/
│   ├── styleEngine.ts  # Dynamic CSS custom properties, font-face injection, and surface tints
│   ├── textMapper.ts   # Non-destructive DOM TreeWalker + Intl.Segmenter sentence/word ranges
│   ├── ttsEngine.ts    # Web Speech synthesis controller synced with CSS.highlights ranges
│   ├── overlayHost.ts  # Closed/isolated Shadow DOM reading ruler & floating TTS pill
│   └── index.ts        # Content script orchestrator subscribing to storage changes
├── background/
│   └── index.ts        # MV3 service worker opening onboarding on install
├── onboarding/
│   └── index.ts        # Material Design 3 profile picker & live preview controller
└── popup/
    └── index.ts        # Extension action popup controller for live setting adjustments
```

## Verification & Testing

Run TypeScript type checking, production bundling, unit test coverage (Vitest + `v8`), and end-to-end Chromium MV3 extension tests (Playwright):

```bash
# Type-check source and tests
npx tsc --noEmit

# Build extension into dist/
npm run build

# Run unit tests with v8 code coverage
npm run test:coverage

# Run Playwright MV3 Chromium extension E2E tests
npm run test:e2e
```

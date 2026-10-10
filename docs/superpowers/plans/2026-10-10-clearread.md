# ClearRead Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ClearRead v1.0, a zero-telemetry Manifest V3 Chrome extension providing Material Design 3 calibrated reading profiles, offline dyslexia-friendly fonts, a Shadow DOM reading ruler, and non-destructive sentence/word TTS highlighting.

**Architecture:** Four TypeScript entry points (`background`, `content`, `onboarding`, `popup`) share immutable state contracts via `chrome.storage.sync`. Host-page adaptations inject local `@font-face` rules, contrast-safe prose CSS (`p, li, dd, dt, blockquote`), native `CSS.highlights` ranges segmented via `Intl.Segmenter`, and isolated Shadow DOM UI overlays.

**Tech Stack:** TypeScript 5, Vite 5, Vitest + `jsdom` + `@vitest/coverage-v8`, Playwright (`@playwright/test`), Chrome Extension Manifest V3, `@fontsource/{lexend,atkinson-hyperlegible,opendyslexic}`

**Spec:** `docs/superpowers/specs/2026-10-10-clearread-design.md`

## Global Constraints

- Zero network telemetry or third-party font CDN requests; all fonts (`Lexend`, `Atkinson Hyperlegible`, `OpenDyslexic`) must be bundled as local `.woff2` files in `dist/fonts/`.
- Strict immutability: state updates must construct and return new objects without mutating existing objects.
- Prose layout safety: `max-width: 75ch !important` applies strictly to `p, li, dd, dt, blockquote` and never to layout containers (`main, section, article, div`).
- Dark-mode contrast safety: non-white surface tints (`#FBF0D9`, `#FFF7E6`, `#EAEFE9`) enforce `#1F1F1F` foreground text ink on prose/headings and `#0B57D0` on links.
- Non-mutating TTS highlights: sentence and word tracking must use `CSS.highlights` + `Range` objects without inserting `<mark>`/`<span>` elements into host DOM text nodes.
- Minimum test coverage: 80%+ across Vitest unit suites, verified alongside Chromium unpacked-extension Playwright E2E tests.

---

### Task 1: Project Scaffolding, Asset Preparation & Shared State Contract

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `scripts/prepare-assets.mjs`
- Create: `src/shared/types.ts`
- Create: `src/shared/profiles.ts`
- Create: `src/shared/storage.ts`
- Test: `tests/unit/shared.test.ts`

**Interfaces:**
- Consumes: `chrome.storage.sync` / `chrome.storage.onChanged`
- Produces:
  - `ProfileKey = 'mild' | 'moderate' | 'heavy'`
  - `FontFamily = 'Lexend' | 'Atkinson Hyperlegible' | 'OpenDyslexic'`
  - `TintColor = '#FFFFFF' | '#FBF0D9' | '#FFF7E6' | '#EAEFE9'`
  - `TtsMode = 'off' | 'alt-click' | 'click'`
  - `ClearReadSettings` interface
  - `PROFILES: Readonly<Record<ProfileKey, Omit<ClearReadSettings, 'hasSeenOnboarding'>>>`
  - `DEFAULT_SETTINGS: ClearReadSettings`
  - `sanitizeSettings(raw: Record<string, unknown>): ClearReadSettings`
  - `getSettings(): Promise<ClearReadSettings>`
  - `updateSettings(patch: Partial<ClearReadSettings>): Promise<ClearReadSettings>`
  - `subscribeSettings(listener: (next: ClearReadSettings) => void): () => void`

- [ ] **Step 1: Initialize `package.json`, `tsconfig.json`, `vitest.config.ts`, and `scripts/prepare-assets.mjs`, then install dependencies**

```json
// package.json
{
  "name": "clearread",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "prepare-assets": "node scripts/prepare-assets.mjs",
    "build": "npm run prepare-assets && vite build && vite build --config vite.content.config.ts",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@fontsource/atkinson-hyperlegible": "^5.1.0",
    "@fontsource/lexend": "^5.1.0",
    "@fontsource/opendyslexic": "^5.1.0",
    "@playwright/test": "^1.48.0",
    "@types/chrome": "^0.0.278",
    "@types/node": "^22.7.0",
    "@vitest/coverage-v8": "^2.1.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "types": ["chrome", "vitest/globals", "node"]
  },
  "include": ["src/**/*", "tests/**/*", "vite*.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
```

```js
// scripts/prepare-assets.mjs
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontsDir = resolve(root, 'public/fonts');
mkdirSync(fontsDir, { recursive: true });

const fontMappings = [
  [
    'node_modules/@fontsource/lexend/files/lexend-latin-400-normal.woff2',
    'public/fonts/Lexend-Regular.woff2'
  ],
  [
    'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2',
    'public/fonts/AtkinsonHyperlegible-Regular.woff2'
  ],
  [
    'node_modules/@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2',
    'public/fonts/OpenDyslexic-Regular.woff2'
  ]
];

for (const [src, dest] of fontMappings) {
  copyFileSync(resolve(root, src), resolve(root, dest));
}

function createIcon128Png() {
  const width = 128;
  const height = 128;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      const isCornerOutside = dx < 20 && dy < 20 && (20 - dx) ** 2 + (20 - dy) ** 2 > 400;
      const isRulerBand = y >= 54 && y <= 72 && x >= 24 && x <= 104;
      const isTextLine =
        ((y >= 34 && y <= 42) || (y >= 84 && y <= 92)) && x >= 28 && x <= 96;

      if (isCornerOutside) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
      } else if (isRulerBand) {
        raw[idx] = 251;
        raw[idx + 1] = 188;
        raw[idx + 2] = 4;
        raw[idx + 3] = 255;
      } else if (isTextLine) {
        raw[idx] = 255;
        raw[idx + 1] = 255;
        raw[idx + 2] = 255;
        raw[idx + 3] = 255;
      } else {
        raw[idx] = 26;
        raw[idx + 1] = 115;
        raw[idx + 2] = 232;
        raw[idx + 3] = 255;
      }
    }
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

writeFileSync(resolve(root, 'public/icon128.png'), createIcon128Png());
```

Run: `npm install && npm run prepare-assets`

- [ ] **Step 2: Write the failing unit tests in `tests/unit/shared.test.ts`**

```ts
// tests/unit/shared.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';
import {
  getSettings,
  sanitizeSettings,
  subscribeSettings,
  updateSettings
} from '../../src/shared/storage';

describe('shared profiles & storage contract', () => {
  let store: Record<string, unknown>;
  let changeListeners: Array<
    (changes: Record<string, chrome.storage.StorageChange>, area: string) => void
  >;

  beforeEach(() => {
    store = {};
    changeListeners = [];
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((defaults: Record<string, unknown>, cb: (res: Record<string, unknown>) => void) => {
            cb({ ...defaults, ...store });
          }),
          set: vi.fn((patch: Record<string, unknown>, cb?: () => void) => {
            const changes: Record<string, chrome.storage.StorageChange> = {};
            for (const [key, value] of Object.entries(patch)) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
            cb?.();
            for (const listener of changeListeners) {
              listener(changes, 'sync');
            }
          })
        },
        onChanged: {
          addListener: vi.fn((fn) => changeListeners.push(fn)),
          removeListener: vi.fn((fn) => {
            changeListeners = changeListeners.filter((l) => l !== fn);
          })
        }
      }
    });
  });

  it('defines three calibrated immutable profiles matching spec defaults', () => {
    expect(PROFILES.mild).toEqual({
      enabled: true,
      profile: 'mild',
      font: 'Lexend',
      lineHeight: '1.65',
      letterSpacing: '0.04em',
      wordSpacing: '0.10em',
      tintColor: '#FFFFFF',
      rulerEnabled: false,
      ttsMode: 'off'
    });
    expect(PROFILES.moderate.ttsMode).toBe('alt-click');
    expect(PROFILES.heavy.ttsMode).toBe('click');
    expect(DEFAULT_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.hasSeenOnboarding).toBe(false);
  });

  it('sanitizes invalid stored values back to safe defaults', () => {
    const cleaned = sanitizeSettings({
      enabled: 'invalid',
      profile: 'unknown',
      font: 'Comic Sans',
      lineHeight: '99',
      tintColor: '#000000',
      ttsMode: 'scream'
    });
    expect(cleaned).toEqual(DEFAULT_SETTINGS);
  });

  it('reads, updates immutably, and notifies subscribers on sync changes', async () => {
    const snapshots: unknown[] = [];
    const unsubscribe = subscribeSettings((next) => snapshots.push(next));

    const initial = await getSettings();
    expect(initial).toEqual(DEFAULT_SETTINGS);

    const updated = await updateSettings({ enabled: true, font: 'Lexend' });
    expect(updated.enabled).toBe(true);
    expect(updated.font).toBe('Lexend');
    expect(initial.enabled).toBe(false);
    expect(snapshots).toHaveLength(1);

    unsubscribe();
    await updateSettings({ rulerEnabled: true });
    expect(snapshots).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/shared.test.ts`
Expected: FAIL (`Cannot find module '../../src/shared/profiles'`)

- [ ] **Step 4: Implement `src/shared/types.ts`, `src/shared/profiles.ts`, and `src/shared/storage.ts`**

```ts
// src/shared/types.ts
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
```

```ts
// src/shared/profiles.ts
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
```

```ts
// src/shared/storage.ts
import { DEFAULT_SETTINGS } from './profiles';
import type { ClearReadSettings, FontFamily, ProfileKey, TintColor, TtsMode } from './types';

const VALID_PROFILES = new Set<ProfileKey>(['mild', 'moderate', 'heavy']);
const VALID_FONTS = new Set<FontFamily>(['Lexend', 'Atkinson Hyperlegible', 'OpenDyslexic']);
const VALID_TINTS = new Set<TintColor>(['#FFFFFF', '#FBF0D9', '#FFF7E6', '#EAEFE9']);
const VALID_TTS_MODES = new Set<TtsMode>(['off', 'alt-click', 'click']);

function isValidLineHeight(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const num = Number.parseFloat(val);
  return Number.isFinite(num) && num >= 1.2 && num <= 3.0;
}

function isValidEmSpacing(val: unknown): val is string {
  return typeof val === 'string' && /^\d+(\.\d+)?em$/.test(val);
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
    ttsMode: VALID_TTS_MODES.has(raw.ttsMode as TtsMode)
      ? (raw.ttsMode as TtsMode)
      : DEFAULT_SETTINGS.ttsMode,
    hasSeenOnboarding:
      typeof raw.hasSeenOnboarding === 'boolean'
        ? raw.hasSeenOnboarding
        : DEFAULT_SETTINGS.hasSeenOnboarding
  });
}

export function getSettings(): Promise<ClearReadSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ ...DEFAULT_SETTINGS }, (items) => {
      resolve(sanitizeSettings(items));
    });
  });
}

export async function updateSettings(
  patch: Partial<ClearReadSettings>
): Promise<ClearReadSettings> {
  const current = await getSettings();
  const next = sanitizeSettings({ ...current, ...patch });
  await new Promise<void>((resolve) => {
    chrome.storage.sync.set({ ...next }, () => resolve());
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
```

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/unit/shared.test.ts`
Expected: PASS

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts scripts/prepare-assets.mjs src/shared/ tests/unit/shared.test.ts
git commit -m "feat: scaffold ClearRead project and shared storage contract"
```

---

### Task 2: Content Script Style Engine (`src/content/styleEngine.ts`)

**Files:**
- Create: `src/content/styleEngine.ts`
- Test: `tests/unit/styleEngine.test.ts`

**Interfaces:**
- Consumes: `ClearReadSettings` from `src/shared/types`
- Produces:
  - `STYLE_EL_ID = 'clearread-styles'`
  - `FONT_EL_ID = 'clearread-fonts'`
  - `applyStyles(settings: ClearReadSettings, doc?: Document): void`
  - `teardownStyles(doc?: Document): void`

- [ ] **Step 1: Write failing tests in `tests/unit/styleEngine.test.ts`**

```ts
// tests/unit/styleEngine.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';
import {
  FONT_EL_ID,
  STYLE_EL_ID,
  applyStyles,
  teardownStyles
} from '../../src/content/styleEngine';

describe('content styleEngine', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-ext/${path}`
      }
    });
  });

  it('injects offline @font-face declarations and scoped leaf prose styles without container max-width', () => {
    applyStyles({ ...PROFILES.moderate, hasSeenOnboarding: true });

    const fontEl = document.getElementById(FONT_EL_ID);
    const styleEl = document.getElementById(STYLE_EL_ID);
    expect(fontEl).not.toBeNull();
    expect(fontEl?.textContent).toContain('chrome-extension://test-ext/fonts/AtkinsonHyperlegible-Regular.woff2');
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain("font-family: 'Atkinson Hyperlegible'");
    expect(styleEl?.textContent).toContain('max-width: 75ch !important;');
    expect(styleEl?.textContent).not.toMatch(/main.*max-width/s);
    expect(styleEl?.textContent).toContain('color: #1F1F1F !important;');
    expect(styleEl?.textContent).toContain('::highlight(clearread-sentence)');
  });

  it('skips background and dark-ink override when tintColor is Clean White (#FFFFFF)', () => {
    applyStyles({ ...PROFILES.mild, hasSeenOnboarding: true });
    const styleEl = document.getElementById(STYLE_EL_ID);
    expect(styleEl?.textContent).not.toContain('background-color: #FFFFFF !important;');
  });

  it('removes prose styles cleanly on teardownStyles', () => {
    applyStyles({ ...DEFAULT_SETTINGS, enabled: true });
    expect(document.getElementById(STYLE_EL_ID)).not.toBeNull();

    teardownStyles();
    expect(document.getElementById(STYLE_EL_ID)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/styleEngine.test.ts`
Expected: FAIL (`Cannot find module '../../src/content/styleEngine'`)

- [ ] **Step 3: Implement `src/content/styleEngine.ts`**

```ts
// src/content/styleEngine.ts
import type { ClearReadSettings } from '../shared/types';

export const STYLE_EL_ID = 'clearread-styles';
export const FONT_EL_ID = 'clearread-fonts';

function buildFontFaceCss(): string {
  const lexend = chrome.runtime.getURL('fonts/Lexend-Regular.woff2');
  const atkinson = chrome.runtime.getURL('fonts/AtkinsonHyperlegible-Regular.woff2');
  const openDyslexic = chrome.runtime.getURL('fonts/OpenDyslexic-Regular.woff2');

  return `
    @font-face {
      font-family: 'Lexend';
      src: url('${lexend}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Atkinson Hyperlegible';
      src: url('${atkinson}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${openDyslexic}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
  `;
}

function buildTintCss(tintColor: ClearReadSettings['tintColor']): string {
  if (tintColor === '#FFFFFF') {
    return '';
  }

  return `
    html, body {
      background-color: ${tintColor} !important;
      color: #1F1F1F !important;
    }
    p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6 {
      color: #1F1F1F !important;
    }
    a {
      color: #0B57D0 !important;
    }
  `;
}

export function applyStyles(settings: ClearReadSettings, doc: Document = document): void {
  if (!settings.enabled) {
    teardownStyles(doc);
    return;
  }

  let fontStyle = doc.getElementById(FONT_EL_ID);
  if (!fontStyle) {
    fontStyle = doc.createElement('style');
    fontStyle.id = FONT_EL_ID;
    fontStyle.textContent = buildFontFaceCss();
    doc.head.appendChild(fontStyle);
  }

  let proseStyle = doc.getElementById(STYLE_EL_ID);
  if (!proseStyle) {
    proseStyle = doc.createElement('style');
    proseStyle.id = STYLE_EL_ID;
    doc.head.appendChild(proseStyle);
  }

  proseStyle.textContent = `
    p, li, dd, dt, blockquote {
      font-family: '${settings.font}', -apple-system, BlinkMacSystemFont, sans-serif !important;
      line-height: ${settings.lineHeight} !important;
      letter-spacing: ${settings.letterSpacing} !important;
      word-spacing: ${settings.wordSpacing} !important;
      text-align: left !important;
      max-width: 75ch !important;
    }
    code, pre, kbd, samp, svg, i, [class*="icon"], [class*="fa-"] {
      font-family: inherit !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
    ::highlight(clearread-sentence) {
      background-color: rgba(26, 115, 232, 0.16);
      color: #1F1F1F;
    }
    ::highlight(clearread-word) {
      background-color: rgba(251, 188, 4, 0.45);
      color: #1F1F1F;
    }
    ${buildTintCss(settings.tintColor)}
  `;
}

export function teardownStyles(doc: Document = document): void {
  doc.getElementById(STYLE_EL_ID)?.remove();
}
```

- [ ] **Step 4: Run test to verify it passes and commit**

Run: `npx vitest run tests/unit/styleEngine.test.ts`
Expected: PASS

```bash
git add src/content/styleEngine.ts tests/unit/styleEngine.test.ts
git commit -m "feat: add offline font-face and contrast-safe style engine"
```

---

### Task 3: Shadow DOM Overlays — Reading Ruler & Floating TTS Pill (`src/content/overlayHost.ts`)

**Files:**
- Create: `src/content/overlayHost.ts`
- Test: `tests/unit/overlayHost.test.ts`

**Interfaces:**
- Consumes: none (pure DOM controller)
- Produces:
  - `OVERLAY_HOST_ID = 'clearread-overlay-host'`
  - `OverlayCallbacks = { readonly onTogglePause: () => void; readonly onStop: () => void }`
  - `TtsPillStatus = 'hidden' | 'speaking' | 'paused'`
  - `OverlayController = { setRulerEnabled(enabled: boolean): void; setTtsStatus(status: TtsPillStatus): void; destroy(): void }`
  - `createOverlayController(callbacks: OverlayCallbacks, doc?: Document): OverlayController`

- [ ] **Step 1: Write failing tests in `tests/unit/overlayHost.test.ts`**

```ts
// tests/unit/overlayHost.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERLAY_HOST_ID, createOverlayController } from '../../src/content/overlayHost';

describe('content overlayHost (Shadow DOM Ruler & TTS Pill)', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  it('tracks cursor Y coordinate when ruler is enabled and hides when disabled', () => {
    const controller = createOverlayController({
      onTogglePause: vi.fn(),
      onStop: vi.fn()
    });

    controller.setRulerEnabled(true);
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 240 }));

    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    const ruler = shadow?.getElementById('clearread-ruler') as HTMLElement;
    expect(ruler.style.display).toBe('block');
    expect(ruler.style.top).toBe('240px');

    controller.setRulerEnabled(false);
    expect(ruler.style.display).toBe('none');
    controller.destroy();
  });

  it('renders M3 floating TTS pill states and invokes pause/stop callbacks', () => {
    const onTogglePause = vi.fn();
    const onStop = vi.fn();
    const controller = createOverlayController({ onTogglePause, onStop });
    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot!;

    const pill = shadow.getElementById('clearread-tts-pill') as HTMLElement;
    expect(pill.hidden).toBe(true);

    controller.setTtsStatus('speaking');
    expect(pill.hidden).toBe(false);
    expect(shadow.getElementById('clearread-tts-status')?.textContent).toBe('Reading…');

    (shadow.getElementById('clearread-tts-pause') as HTMLButtonElement).click();
    expect(onTogglePause).toHaveBeenCalledTimes(1);

    controller.setTtsStatus('paused');
    expect(shadow.getElementById('clearread-tts-status')?.textContent).toBe('Paused');

    (shadow.getElementById('clearread-tts-stop') as HTMLButtonElement).click();
    expect(onStop).toHaveBeenCalledTimes(1);

    controller.destroy();
    expect(document.getElementById(OVERLAY_HOST_ID)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/overlayHost.test.ts`
Expected: FAIL (`Cannot find module '../../src/content/overlayHost'`)

- [ ] **Step 3: Implement `src/content/overlayHost.ts`**

```ts
// src/content/overlayHost.ts
export const OVERLAY_HOST_ID = 'clearread-overlay-host';

export interface OverlayCallbacks {
  readonly onTogglePause: () => void;
  readonly onStop: () => void;
}

export type TtsPillStatus = 'hidden' | 'speaking' | 'paused';

export interface OverlayController {
  setRulerEnabled(enabled: boolean): void;
  setTtsStatus(status: TtsPillStatus): void;
  destroy(): void;
}

const SHADOW_STYLES = `
  :host {
    all: initial;
  }
  #clearread-ruler {
    position: fixed;
    left: 0;
    width: 100vw;
    height: 36px;
    background-color: rgba(255, 255, 0, 0.18);
    border-top: 2px solid rgba(180, 150, 0, 0.35);
    border-bottom: 2px solid rgba(180, 150, 0, 0.35);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
    transform: translateY(-50%);
  }
  #clearread-tts-pill {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 9999px;
    background: #1F1F1F;
    color: #FFFFFF;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  }
  #clearread-tts-pill[hidden] {
    display: none !important;
  }
  .pill-btn {
    border: none;
    border-radius: 9999px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: #D3E3FD;
    color: #041E49;
  }
  .pill-btn-stop {
    background: #F9DEDC;
    color: #410E0B;
  }
`;

export function createOverlayController(
  callbacks: OverlayCallbacks,
  doc: Document = document
): OverlayController {
  doc.getElementById(OVERLAY_HOST_ID)?.remove();

  const host = doc.createElement('div');
  host.id = OVERLAY_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = SHADOW_STYLES;

  const ruler = doc.createElement('div');
  ruler.id = 'clearread-ruler';

  const pill = doc.createElement('div');
  pill.id = 'clearread-tts-pill';
  pill.hidden = true;

  const statusSpan = doc.createElement('span');
  statusSpan.id = 'clearread-tts-status';
  statusSpan.textContent = 'Reading…';

  const pauseBtn = doc.createElement('button');
  pauseBtn.id = 'clearread-tts-pause';
  pauseBtn.className = 'pill-btn';
  pauseBtn.type = 'button';
  pauseBtn.textContent = 'Pause';
  pauseBtn.setAttribute('aria-label', 'Pause reading');
  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onTogglePause();
  });

  const stopBtn = doc.createElement('button');
  stopBtn.id = 'clearread-tts-stop';
  stopBtn.className = 'pill-btn pill-btn-stop';
  stopBtn.type = 'button';
  stopBtn.textContent = 'Stop';
  stopBtn.setAttribute('aria-label', 'Stop reading');
  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onStop();
  });

  pill.append(statusSpan, pauseBtn, stopBtn);
  shadow.append(style, ruler, pill);
  doc.documentElement.appendChild(host);

  let rulerActive = false;

  const onMouseMove = (e: MouseEvent) => {
    if (!rulerActive) return;
    window.requestAnimationFrame(() => {
      if (!rulerActive) return;
      ruler.style.display = 'block';
      ruler.style.top = `${e.clientY}px`;
    });
  };

  return {
    setRulerEnabled(enabled: boolean) {
      if (enabled === rulerActive) return;
      rulerActive = enabled;
      if (enabled) {
        window.addEventListener('mousemove', onMouseMove, { passive: true });
      } else {
        window.removeEventListener('mousemove', onMouseMove);
        ruler.style.display = 'none';
      }
    },

    setTtsStatus(status: TtsPillStatus) {
      if (status === 'hidden') {
        pill.hidden = true;
        return;
      }
      pill.hidden = false;
      statusSpan.textContent = status === 'paused' ? 'Paused' : 'Reading…';
      pauseBtn.textContent = status === 'paused' ? 'Resume' : 'Pause';
      pauseBtn.setAttribute(
        'aria-label',
        status === 'paused' ? 'Resume reading' : 'Pause reading'
      );
    },

    destroy() {
      rulerActive = false;
      window.removeEventListener('mousemove', onMouseMove);
      host.remove();
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes and commit**

Run: `npx vitest run tests/unit/overlayHost.test.ts`
Expected: PASS

```bash
git add src/content/overlayHost.ts tests/unit/overlayHost.test.ts
git commit -m "feat: add Shadow DOM reading ruler and floating TTS control pill"
```

---

### Task 4: Sentence Segmentation & Non-Mutating Range Mapper (`src/content/textMapper.ts`)

**Files:**
- Create: `src/content/textMapper.ts`
- Test: `tests/unit/textMapper.test.ts`

**Interfaces:**
- Consumes: `TtsMode` from `src/shared/types`
- Produces:
  - `TextNodeSlice = { readonly node: Text; readonly start: number; readonly end: number }`
  - `SentenceSegment = { readonly text: string; readonly startOffset: number; readonly endOffset: number; readonly range: Range; readonly slices: readonly TextNodeSlice[] }`
  - `findReadableBlock(target: EventTarget | null): HTMLElement | null`
  - `shouldTriggerTts(event: MouseEvent, ttsMode: TtsMode): HTMLElement | null`
  - `extractSentenceSegments(block: HTMLElement, lang?: string): SentenceSegment[]`
  - `createWordRange(segment: SentenceSegment, charIndex: number, charLength?: number): Range | null`

- [ ] **Step 1: Write failing tests in `tests/unit/textMapper.test.ts`**

```ts
// tests/unit/textMapper.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createWordRange,
  extractSentenceSegments,
  shouldTriggerTts
} from '../../src/content/textMapper';

describe('content textMapper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('segments sentences across nested inline nodes without mutating the DOM', () => {
    document.body.innerHTML = `
      <p id="prose">First <strong>bold</strong> sentence. Second <a href="#x">linked</a> sentence!</p>
    `;
    const p = document.getElementById('prose')!;
    const originalHtml = p.innerHTML;

    const segments = extractSentenceSegments(p, 'en');
    expect(segments).toHaveLength(2);
    expect(segments[0].range.toString().trim()).toBe('First bold sentence.');
    expect(segments[1].range.toString().trim()).toBe('Second linked sentence!');

    const boldWordRange = createWordRange(segments[0], 6);
    expect(boldWordRange?.toString()).toBe('bold');
    expect(p.innerHTML).toBe(originalHtml);
  });

  it('enforces ttsMode click vs alt-click rules and skips links on plain click', () => {
    document.body.innerHTML = `<p id="p">Read <a id="lnk" href="/test">this link</a> carefully.</p>`;
    const p = document.getElementById('p')!;
    const lnk = document.getElementById('lnk')!;

    expect(shouldTriggerTts(new MouseEvent('click', { bubbles: true }), 'off')).toBeNull();

    const clickOnLink = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickOnLink, 'target', { value: lnk });
    expect(shouldTriggerTts(clickOnLink, 'click')).toBeNull();

    const altClickOnLink = new MouseEvent('click', { altKey: true, bubbles: true });
    Object.defineProperty(altClickOnLink, 'target', { value: lnk });
    expect(shouldTriggerTts(altClickOnLink, 'alt-click')).toBe(p);

    const clickOnProse = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickOnProse, 'target', { value: p });
    expect(shouldTriggerTts(clickOnProse, 'click')).toBe(p);
    expect(shouldTriggerTts(clickOnProse, 'alt-click')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/textMapper.test.ts`
Expected: FAIL (`Cannot find module '../../src/content/textMapper'`)

- [ ] **Step 3: Implement `src/content/textMapper.ts`**

```ts
// src/content/textMapper.ts
import type { TtsMode } from '../shared/types';

export interface TextNodeSlice {
  readonly node: Text;
  readonly start: number;
  readonly end: number;
}

export interface SentenceSegment {
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly range: Range;
  readonly slices: readonly TextNodeSlice[];
}

const READABLE_SELECTOR = 'p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6';
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, summary, [role="button"]';

export function findReadableBlock(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const block = target.closest(READABLE_SELECTOR);
  return block instanceof HTMLElement ? block : null;
}

export function shouldTriggerTts(event: MouseEvent, ttsMode: TtsMode): HTMLElement | null {
  if (ttsMode === 'off') return null;
  if (ttsMode === 'alt-click' && !event.altKey) return null;

  if (!event.altKey && event.target instanceof Element) {
    if (event.target.closest(INTERACTIVE_SELECTOR)) return null;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return null;
  }

  return findReadableBlock(event.target);
}

function resolvePosition(
  slices: readonly TextNodeSlice[],
  charOffset: number
): { node: Text; offset: number } {
  for (const slice of slices) {
    if (charOffset <= slice.end) {
      return {
        node: slice.node,
        offset: Math.max(0, Math.min(slice.node.length, charOffset - slice.start))
      };
    }
  }
  const last = slices[slices.length - 1];
  return { node: last.node, offset: last.node.length };
}

export function extractSentenceSegments(
  block: HTMLElement,
  lang: string = document.documentElement.lang || 'en'
): SentenceSegment[] {
  const doc = block.ownerDocument;
  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const slices: TextNodeSlice[] = [];
  let cursor = 0;

  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text && current.data.length > 0) {
      slices.push({
        node: current,
        start: cursor,
        end: cursor + current.data.length
      });
      cursor += current.data.length;
    }
    current = walker.nextNode();
  }

  if (slices.length === 0) return [];

  const fullText = slices.map((s) => s.node.data).join('');
  if (fullText.trim().length < 2) return [];

  const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
  const segments: SentenceSegment[] = [];

  for (const item of segmenter.segment(fullText)) {
    const trimmed = item.segment.trim();
    if (!trimmed) continue;

    const leadingSpaces = item.segment.indexOf(trimmed);
    const startOffset = item.index + leadingSpaces;
    const endOffset = startOffset + trimmed.length;

    const startPos = resolvePosition(slices, startOffset);
    const endPos = resolvePosition(slices, endOffset);

    const range = doc.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    segments.push({
      text: trimmed,
      startOffset,
      endOffset,
      range,
      slices
    });
  }

  return segments;
}

export function createWordRange(
  segment: SentenceSegment,
  charIndex: number,
  charLength?: number
): Range | null {
  if (charIndex < 0 || charIndex >= segment.text.length) return null;

  const length =
    charLength && charLength > 0
      ? charLength
      : (segment.text.slice(charIndex).match(/^\S+/)?.[0].length ?? 0);

  if (length <= 0) return null;

  const absStart = segment.startOffset + charIndex;
  const absEnd = Math.min(segment.endOffset, absStart + length);

  const startPos = resolvePosition(segment.slices, absStart);
  const endPos = resolvePosition(segment.slices, absEnd);

  const range = segment.slices[0].node.ownerDocument.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}
```

- [ ] **Step 4: Run test to verify it passes and commit**

Run: `npx vitest run tests/unit/textMapper.test.ts`
Expected: PASS

```bash
git add src/content/textMapper.ts tests/unit/textMapper.test.ts
git commit -m "feat: add DOM-preserving sentence segmenter and word range mapper"
```

---

### Task 5: Micro-TTS Playback Controller, Content Entry & Service Worker (`src/content/ttsEngine.ts`, `src/content/index.ts`, `src/background/index.ts`)

**Files:**
- Create: `src/content/ttsEngine.ts`
- Create: `src/content/index.ts`
- Create: `src/background/index.ts`
- Test: `tests/unit/ttsEngine.test.ts`

**Interfaces:**
- Consumes: `OverlayController`, `extractSentenceSegments`, `createWordRange`, `shouldTriggerTts`, `applyStyles`, `getSettings`, `subscribeSettings`
- Produces:
  - `TtsController = { speakBlock(block: HTMLElement): void; togglePause(): void; stop(): void }`
  - `createTtsController(overlay: Pick<OverlayController, 'setTtsStatus'>, doc?: Document): TtsController`
  - `initContentScript(): Promise<() => void>`
  - `initBackground(): void`

- [ ] **Step 1: Write failing tests in `tests/unit/ttsEngine.test.ts`**

```ts
// tests/unit/ttsEngine.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initBackground } from '../../src/background/index';
import { createTtsController } from '../../src/content/ttsEngine';

class FakeHighlight {
  readonly ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

describe('content ttsEngine & background worker', () => {
  let utterances: Array<Record<string, any>>;
  let highlightMap: Map<string, FakeHighlight>;

  beforeEach(() => {
    document.body.innerHTML = `<p id="target">Hello world. Second sentence here.</p>`;
    utterances = [];
    highlightMap = new Map();

    vi.stubGlobal('Highlight', FakeHighlight);
    Object.defineProperty(globalThis, 'CSS', {
      value: { highlights: highlightMap },
      configurable: true
    });

    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        rate = 1;
        onstart: (() => void) | null = null;
        onboundary: ((e: { name: string; charIndex: number; charLength?: number }) => void) | null =
          null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
          utterances.push(this);
        }
      }
    );

    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn((u: Record<string, any>) => {
        u.onstart?.();
      })
    });
  });

  it('highlights active sentence and words via CSS.highlights and clears on stop', () => {
    const statuses: string[] = [];
    const tts = createTtsController({
      setTtsStatus: (s) => statuses.push(s)
    });

    const p = document.getElementById('target')!;
    tts.speakBlock(p);

    expect(statuses[0]).toBe('speaking');
    expect(utterances[0].text).toBe('Hello world.');
    expect(highlightMap.get('clearread-sentence')?.ranges[0].toString()).toBe('Hello world.');

    utterances[0].onboundary?.({ name: 'word', charIndex: 6, charLength: 5 });
    expect(highlightMap.get('clearread-word')?.ranges[0].toString()).toBe('world');

    utterances[0].onend?.();
    expect(utterances[1].text).toBe('Second sentence here.');

    tts.togglePause();
    expect(window.speechSynthesis.pause).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('paused');

    tts.togglePause();
    expect(window.speechSynthesis.resume).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('speaking');

    tts.stop();
    expect(highlightMap.size).toBe(0);
    expect(statuses.at(-1)).toBe('hidden');
  });

  it('opens onboarding.html only on initial install in background worker', () => {
    let listener: ((details: { reason: string }) => void) | undefined;
    const createTab = vi.fn();
    vi.stubGlobal('chrome', {
      runtime: {
        onInstalled: {
          addListener: (fn: (details: { reason: string }) => void) => {
            listener = fn;
          }
        }
      },
      tabs: { create: createTab }
    });

    initBackground();
    listener?.({ reason: 'update' });
    expect(createTab).not.toHaveBeenCalled();

    listener?.({ reason: 'install' });
    expect(createTab).toHaveBeenCalledWith({ url: 'onboarding.html' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ttsEngine.test.ts`
Expected: FAIL (`Cannot find module '../../src/background/index'`)

- [ ] **Step 3: Implement `src/content/ttsEngine.ts`, `src/content/index.ts`, and `src/background/index.ts`**

```ts
// src/content/ttsEngine.ts
import type { OverlayController } from './overlayHost';
import { createWordRange, extractSentenceSegments, type SentenceSegment } from './textMapper';

export interface TtsController {
  speakBlock(block: HTMLElement): void;
  togglePause(): void;
  stop(): void;
}

const SENTENCE_HIGHLIGHT = 'clearread-sentence';
const WORD_HIGHLIGHT = 'clearread-word';

function setHighlightRange(name: string, range: Range | null): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS) || typeof Highlight === 'undefined') {
    return;
  }
  if (!range) {
    CSS.highlights.delete(name);
    return;
  }
  CSS.highlights.set(name, new Highlight(range));
}

function clearAllHighlights(): void {
  if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
    CSS.highlights.delete(SENTENCE_HIGHLIGHT);
    CSS.highlights.delete(WORD_HIGHLIGHT);
  }
}

export function createTtsController(
  overlay: Pick<OverlayController, 'setTtsStatus'>,
  doc: Document = document
): TtsController {
  let sessionId = 0;
  let paused = false;
  let active = false;

  const stop = () => {
    sessionId += 1;
    paused = false;
    active = false;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearAllHighlights();
    overlay.setTtsStatus('hidden');
  };

  const speakSegmentAt = (
    segments: readonly SentenceSegment[],
    index: number,
    currentSession: number
  ) => {
    if (currentSession !== sessionId || index >= segments.length || !('speechSynthesis' in window)) {
      stop();
      return;
    }

    const segment = segments[index];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.rate = 0.95;

    utterance.onstart = () => {
      if (currentSession !== sessionId) return;
      setHighlightRange(SENTENCE_HIGHLIGHT, segment.range);
      setHighlightRange(WORD_HIGHLIGHT, null);
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (currentSession !== sessionId || event.name !== 'word') return;
      const wordRange = createWordRange(segment, event.charIndex, event.charLength);
      setHighlightRange(WORD_HIGHLIGHT, wordRange);
    };

    utterance.onend = () => {
      if (currentSession !== sessionId) return;
      speakSegmentAt(segments, index + 1, currentSession);
    };

    utterance.onerror = () => {
      if (currentSession !== sessionId) return;
      stop();
    };

    window.speechSynthesis.speak(utterance);
  };

  return {
    speakBlock(block: HTMLElement) {
      if (!('speechSynthesis' in window)) return;
      stop();
      const segments = extractSentenceSegments(block, doc.documentElement.lang || 'en');
      if (segments.length === 0) return;

      active = true;
      paused = false;
      const currentSession = sessionId;
      overlay.setTtsStatus('speaking');
      speakSegmentAt(segments, 0, currentSession);
    },

    togglePause() {
      if (!active || !('speechSynthesis' in window)) return;
      if (paused) {
        window.speechSynthesis.resume();
        paused = false;
        overlay.setTtsStatus('speaking');
      } else {
        window.speechSynthesis.pause();
        paused = true;
        overlay.setTtsStatus('paused');
      }
    },

    stop
  };
}
```

```ts
// src/content/index.ts
import { getSettings, subscribeSettings } from '../shared/storage';
import type { ClearReadSettings } from '../shared/types';
import { createOverlayController } from './overlayHost';
import { applyStyles, teardownStyles } from './styleEngine';
import { shouldTriggerTts } from './textMapper';
import { createTtsController } from './ttsEngine';

export async function initContentScript(): Promise<() => void> {
  let state: ClearReadSettings = await getSettings();

  const overlay = createOverlayController({
    onTogglePause: () => tts.togglePause(),
    onStop: () => tts.stop()
  });
  const tts = createTtsController(overlay);

  const syncState = (next: ClearReadSettings) => {
    state = next;
    if (state.enabled) {
      applyStyles(state);
      overlay.setRulerEnabled(state.rulerEnabled);
      if (state.ttsMode === 'off') {
        tts.stop();
      }
    } else {
      teardownStyles();
      overlay.setRulerEnabled(false);
      tts.stop();
    }
  };

  syncState(state);
  const unsubscribe = subscribeSettings(syncState);

  const onClick = (event: MouseEvent) => {
    if (!state.enabled) return;
    const block = shouldTriggerTts(event, state.ttsMode);
    if (!block) return;
    if (event.altKey) {
      event.preventDefault();
    }
    tts.speakBlock(block);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      tts.stop();
    }
  };

  window.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    unsubscribe();
    window.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKeyDown);
    tts.stop();
    overlay.destroy();
    teardownStyles();
  };
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  void initContentScript();
}
```

```ts
// src/background/index.ts
export function initBackground(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({ url: 'onboarding.html' });
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  initBackground();
}
```

- [ ] **Step 4: Run test to verify it passes and commit**

Run: `npx vitest run tests/unit/ttsEngine.test.ts`
Expected: PASS

```bash
git add src/content/ttsEngine.ts src/content/index.ts src/background/index.ts tests/unit/ttsEngine.test.ts
git commit -m "feat: add Micro-TTS highlighter controller, content orchestrator, and background worker"
```

---

### Task 6: Material Design 3 Extension UI — Onboarding & Toolbar Popup (`public/styles/`, `onboarding.html`, `popup.html`)

**Files:**
- Create: `public/styles/m3-theme.css`
- Create: `public/styles/fonts.css`
- Create: `onboarding.html`
- Create: `src/onboarding/index.ts`
- Create: `popup.html`
- Create: `src/popup/index.ts`
- Test: `tests/unit/ui.test.ts`

**Interfaces:**
- Consumes: `PROFILES`, `getSettings`, `updateSettings` from `src/shared/`
- Produces:
  - `initOnboarding(doc?: Document): void`
  - `initPopup(doc?: Document): Promise<void>`

- [ ] **Step 1: Write failing tests in `tests/unit/ui.test.ts`**

```ts
// tests/unit/ui.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initOnboarding } from '../../src/onboarding/index';
import { initPopup } from '../../src/popup/index';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';

describe('Material Design 3 Onboarding & Popup UI controllers', () => {
  let stored: Record<string, unknown>;
  let createTab: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stored = { ...DEFAULT_SETTINGS };
    createTab = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: (_def: unknown, cb: (res: Record<string, unknown>) => void) => cb({ ...stored }),
          set: (patch: Record<string, unknown>, cb?: () => void) => {
            stored = { ...stored, ...patch };
            cb?.();
          }
        }
      },
      tabs: { create: createTab }
    });
  });

  it('switches onboarding profile preview and persists chosen preset on save', () => {
    const html = readFileSync(resolve(process.cwd(), 'onboarding.html'), 'utf8');
    document.documentElement.innerHTML = html;
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    initOnboarding(document);

    const heavyCard = document.querySelector('[data-profile="heavy"]') as HTMLElement;
    heavyCard.click();

    const previewBox = document.getElementById('previewBox') as HTMLElement;
    expect(previewBox.style.fontFamily).toContain('OpenDyslexic');
    expect(previewBox.style.lineHeight).toBe('2.0');

    (document.getElementById('saveBtn') as HTMLButtonElement).click();
    expect(stored.font).toBe(PROFILES.heavy.font);
    expect(stored.ttsMode).toBe('click');
    expect(stored.hasSeenOnboarding).toBe(true);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('hydrates popup controls from storage and updates settings immutably on input', async () => {
    stored = { ...PROFILES.moderate, hasSeenOnboarding: true };
    const html = readFileSync(resolve(process.cwd(), 'popup.html'), 'utf8');
    document.documentElement.innerHTML = html;

    await initPopup(document);

    const fontSelect = document.getElementById('fontSelect') as HTMLSelectElement;
    expect(fontSelect.value).toBe('Atkinson Hyperlegible');

    fontSelect.value = 'Lexend';
    fontSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.font).toBe('Lexend');

    const ttsSelect = document.getElementById('ttsSelect') as HTMLSelectElement;
    ttsSelect.value = 'click';
    ttsSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.ttsMode).toBe('click');

    (document.getElementById('resetProfilesLink') as HTMLAnchorElement).click();
    expect(createTab).toHaveBeenCalledWith({ url: 'onboarding.html' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui.test.ts`
Expected: FAIL (`Cannot find module '../../src/onboarding/index'`)

- [ ] **Step 3: Create `public/styles/fonts.css`, `public/styles/m3-theme.css`, `onboarding.html`, `src/onboarding/index.ts`, `popup.html`, and `src/popup/index.ts`**

```css
/* public/styles/fonts.css */
@font-face {
  font-family: 'Lexend';
  src: url('../fonts/Lexend-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Atkinson Hyperlegible';
  src: url('../fonts/AtkinsonHyperlegible-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'OpenDyslexic';
  src: url('../fonts/OpenDyslexic-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

```css
/* public/styles/m3-theme.css */
:root {
  --md-sys-color-primary: #1A73E8;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #D3E3FD;
  --md-sys-color-on-primary-container: #041E49;

  --md-sys-color-surface: #F8F9FA;
  --md-sys-color-surface-container-low: #F1F3F4;
  --md-sys-color-surface-container: #E8EAED;
  --md-sys-color-surface-container-high: #DADCE0;
  --md-sys-color-on-surface: #1F1F1F;
  --md-sys-color-on-surface-variant: #444746;
  --md-sys-color-outline: #747775;
  --md-sys-color-outline-variant: #C4C7C5;

  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-full: 9999px;
  --md-sys-elevation-1: 0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.30);
}

body {
  margin: 0;
  font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  -webkit-font-smoothing: antialiased;
}
```

```html
<!-- onboarding.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Welcome to ClearRead - Material Setup</title>
  <link rel="stylesheet" href="./styles/fonts.css">
  <link rel="stylesheet" href="./styles/m3-theme.css">
  <style>
    * { box-sizing: border-box; }
    .page-wrapper { max-width: 820px; margin: 48px auto; padding: 0 24px; }
    .headline-large { font-size: 32px; line-height: 40px; font-weight: 400; margin: 0 0 8px; text-align: center; }
    .body-large { font-size: 16px; line-height: 24px; color: var(--md-sys-color-on-surface-variant); margin: 0 0 36px; text-align: center; }
    .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .m3-card {
      background: var(--md-sys-color-surface);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-large);
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    }
    .m3-card:hover { box-shadow: var(--md-sys-elevation-1); border-color: var(--md-sys-color-outline); }
    .m3-card.selected { background: var(--md-sys-color-primary-container); border-color: var(--md-sys-color-primary); }
    .m3-card .title-medium { font-size: 16px; font-weight: 500; color: var(--md-sys-color-on-surface); margin: 0 0 8px; }
    .m3-card.selected .title-medium { color: var(--md-sys-color-on-primary-container); }
    .m3-card .body-medium { font-size: 14px; line-height: 20px; color: var(--md-sys-color-on-surface-variant); margin: 0; }
    .m3-card.selected .body-medium { color: var(--md-sys-color-on-primary-container); }
    .preview-card {
      background: var(--md-sys-color-surface-container-low);
      border-radius: var(--md-sys-shape-corner-large);
      padding: 24px;
      margin-bottom: 36px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }
    .label-small { font-size: 11px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); margin-bottom: 12px; }
    #previewBox { padding: 20px; border-radius: var(--md-sys-shape-corner-medium); transition: all 0.2s ease; color: #1F1F1F; }
    .actions { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .m3-btn-filled {
      height: 48px;
      padding: 0 32px;
      border-radius: var(--md-sys-shape-corner-full);
      background-color: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      font-size: 14px;
      font-weight: 500;
      border: none;
      cursor: pointer;
    }
    .m3-btn-filled:hover { box-shadow: var(--md-sys-elevation-1); }
    #saveStatus { font-size: 13px; color: var(--md-sys-color-primary); min-height: 18px; }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <h1 class="headline-large">Choose your reading profile</h1>
    <p class="body-large">Select the profile that feels easiest on your eyes. You can fine-tune individual controls at any time.</p>
    <div class="cards-grid">
      <div class="m3-card selected" data-profile="mild">
        <h2 class="title-medium">Subtle Clarity</h2>
        <p class="body-medium">For mild fatigue. Generous spacing and Lexend typography without color washes or reading guides.</p>
      </div>
      <div class="m3-card" data-profile="moderate">
        <h2 class="title-medium">Focused Tracking</h2>
        <p class="body-medium">For tracking drift and line-skipping. Includes a warm tint, Atkinson Hyperlegible, and a dynamic ruler.</p>
      </div>
      <div class="m3-card" data-profile="heavy">
        <h2 class="title-medium">Multi-Sensory</h2>
        <p class="body-medium">For high decoding strain. Weighted OpenDyslexic characters, soft peach tint, and click-to-speak audio.</p>
      </div>
    </div>
    <div class="preview-card">
      <div class="label-small">Live Text Preview</div>
      <div id="previewBox">
        Reading on screen should not feel like an obstacle course. When typography is given generous vertical breathing room and letters have distinct forms, words stop blending together. Try choosing a profile above to see how this paragraph shifts.
      </div>
    </div>
    <div class="actions">
      <button class="m3-btn-filled" id="saveBtn" type="button">Apply Profile &amp; Start Reading</button>
      <div id="saveStatus" aria-live="polite"></div>
    </div>
  </div>
  <script type="module" src="./src/onboarding/index.ts"></script>
</body>
</html>
```

```ts
// src/onboarding/index.ts
import { PROFILES } from '../shared/profiles';
import type { ProfileKey } from '../shared/types';

export function initOnboarding(doc: Document = document): void {
  const previewBox = doc.getElementById('previewBox') as HTMLElement | null;
  const saveBtn = doc.getElementById('saveBtn') as HTMLButtonElement | null;
  const saveStatus = doc.getElementById('saveStatus') as HTMLElement | null;
  const cards = doc.querySelectorAll<HTMLElement>('.m3-card');

  if (!previewBox || !saveBtn || cards.length === 0) return;

  let currentProfile: ProfileKey = 'mild';

  const updatePreview = (profileKey: ProfileKey) => {
    const config = PROFILES[profileKey];
    previewBox.style.fontFamily = `'${config.font}', sans-serif`;
    previewBox.style.lineHeight = config.lineHeight;
    previewBox.style.letterSpacing = config.letterSpacing;
    previewBox.style.wordSpacing = config.wordSpacing;
    previewBox.style.backgroundColor = config.tintColor;
    previewBox.style.border = config.rulerEnabled
      ? '2px dashed #D97706'
      : '1px solid var(--md-sys-color-outline-variant)';
  };

  updatePreview(currentProfile);

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const key = card.dataset.profile as ProfileKey | undefined;
      if (key && key in PROFILES) {
        currentProfile = key;
        updatePreview(currentProfile);
      }
    });
  });

  saveBtn.addEventListener('click', () => {
    const settingsToSave = {
      ...PROFILES[currentProfile],
      hasSeenOnboarding: true
    };
    chrome.storage.sync.set(settingsToSave, () => {
      if (saveStatus) {
        saveStatus.textContent = 'Profile applied!';
      }
      window.close();
    });
  });
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initOnboarding(document));
  } else {
    initOnboarding(document);
  }
}
```

```html
<!-- popup.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ClearRead Controls</title>
  <link rel="stylesheet" href="./styles/fonts.css">
  <link rel="stylesheet" href="./styles/m3-theme.css">
  <style>
    body {
      width: 280px;
      padding: 16px;
      background-color: var(--md-sys-color-surface-container-low);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header h2 { font-size: 18px; font-weight: 500; margin: 0; }
    .m3-field { margin-bottom: 14px; }
    .m3-field label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 6px;
    }
    select {
      width: 100%;
      height: 38px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid var(--md-sys-color-outline);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
    }
    .m3-switch-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .m3-switch-row label { font-size: 14px; color: var(--md-sys-color-on-surface); cursor: pointer; }
    input[type="range"] { width: 100%; accent-color: var(--md-sys-color-primary); }
    .re-onboard-link {
      display: block;
      margin-top: 14px;
      text-align: center;
      font-size: 12px;
      color: var(--md-sys-color-primary);
      text-decoration: none;
      cursor: pointer;
    }
    .re-onboard-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h2>ClearRead</h2>
    <input type="checkbox" id="enabled" aria-label="Enable ClearRead">
  </div>
  <div class="m3-field">
    <label for="fontSelect">Typeface</label>
    <select id="fontSelect">
      <option value="Lexend">Lexend</option>
      <option value="Atkinson Hyperlegible">Atkinson Hyperlegible</option>
      <option value="OpenDyslexic">OpenDyslexic</option>
    </select>
  </div>
  <div class="m3-switch-row">
    <label for="rulerToggle">Reading Ruler</label>
    <input type="checkbox" id="rulerToggle">
  </div>
  <div class="m3-field">
    <label for="lineHeight">Line Spacing</label>
    <input type="range" id="lineHeight" min="1.4" max="2.4" step="0.05" value="1.8">
  </div>
  <div class="m3-field">
    <label for="tintSelect">Paper Tint</label>
    <select id="tintSelect">
      <option value="#FFFFFF">Clean White</option>
      <option value="#FBF0D9">Warm Parchment</option>
      <option value="#FFF7E6">Soft Peach</option>
      <option value="#EAEFE9">Muted Sage</option>
    </select>
  </div>
  <div class="m3-field">
    <label for="ttsSelect">Micro-TTS Audio</label>
    <select id="ttsSelect">
      <option value="off">Off</option>
      <option value="alt-click">Standby (Alt + Click)</option>
      <option value="click">Click to Speak</option>
    </select>
  </div>
  <a class="re-onboard-link" id="resetProfilesLink" href="#onboarding">Recalibrate Profile</a>
  <script type="module" src="./src/popup/index.ts"></script>
</body>
</html>
```

```ts
// src/popup/index.ts
import { getSettings, updateSettings } from '../shared/storage';
import type { FontFamily, TintColor, TtsMode } from '../shared/types';

export async function initPopup(doc: Document = document): Promise<void> {
  const enabledEl = doc.getElementById('enabled') as HTMLInputElement | null;
  const fontEl = doc.getElementById('fontSelect') as HTMLSelectElement | null;
  const rulerEl = doc.getElementById('rulerToggle') as HTMLInputElement | null;
  const lineHeightEl = doc.getElementById('lineHeight') as HTMLInputElement | null;
  const tintEl = doc.getElementById('tintSelect') as HTMLSelectElement | null;
  const ttsEl = doc.getElementById('ttsSelect') as HTMLSelectElement | null;
  const resetLink = doc.getElementById('resetProfilesLink') as HTMLAnchorElement | null;

  if (!enabledEl || !fontEl || !rulerEl || !lineHeightEl || !tintEl || !ttsEl || !resetLink) {
    return;
  }

  const current = await getSettings();
  enabledEl.checked = current.enabled;
  fontEl.value = current.font;
  rulerEl.checked = current.rulerEnabled;
  lineHeightEl.value = current.lineHeight;
  tintEl.value = current.tintColor;
  ttsEl.value = current.ttsMode;

  enabledEl.addEventListener('change', () => {
    void updateSettings({ enabled: enabledEl.checked });
  });
  fontEl.addEventListener('change', () => {
    void updateSettings({ font: fontEl.value as FontFamily });
  });
  rulerEl.addEventListener('change', () => {
    void updateSettings({ rulerEnabled: rulerEl.checked });
  });
  lineHeightEl.addEventListener('input', () => {
    void updateSettings({ lineHeight: lineHeightEl.value });
  });
  tintEl.addEventListener('change', () => {
    void updateSettings({ tintColor: tintEl.value as TintColor });
  });
  ttsEl.addEventListener('change', () => {
    void updateSettings({ ttsMode: ttsEl.value as TtsMode });
  });
  resetLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'onboarding.html' });
  });
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void initPopup(document));
  } else {
    void initPopup(document);
  }
}
```

- [ ] **Step 4: Run test to verify it passes and commit**

Run: `npx vitest run tests/unit/ui.test.ts`
Expected: PASS

```bash
git add public/styles/ onboarding.html popup.html src/onboarding/ src/popup/ tests/unit/ui.test.ts
git commit -m "feat: add Material Design 3 onboarding and toolbar popup UIs"
```

---

### Task 7: Vite MV3 Multi-Entry Bundling, Manifest & End-to-End Playwright Verification

**Files:**
- Create: `public/manifest.json`
- Create: `vite.config.ts`
- Create: `vite.content.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/extension.spec.ts`

**Interfaces:**
- Consumes: All extension entry points (`popup.html`, `onboarding.html`, `src/background/index.ts`, `src/content/index.ts`)
- Produces: Complete unpacked Chrome Manifest V3 extension in `dist/` verified under Playwright Chromium with ≥80% unit coverage

- [ ] **Step 1: Create `public/manifest.json`, `vite.config.ts`, `vite.content.config.ts`, and `playwright.config.ts`**

```json
// public/manifest.json
{
  "manifest_version": 3,
  "name": "ClearRead: Dyslexia Assistant",
  "version": "1.0.0",
  "description": "Accessible typography, visual tracking aids, and synchronized audio tools built with Material Design 3.",
  "permissions": ["storage", "activeTab"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "128": "icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["fonts/*.woff2", "styles/*.css"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

```ts
// vite.config.ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
        background: resolve(__dirname, 'src/background/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'
      }
    }
  }
});
```

```ts
// vite.content.config.ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'ClearReadContent',
      formats: ['iife'],
      fileName: () => 'content.js'
    }
  }
});
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    headless: true
  }
});
```

- [ ] **Step 2: Write end-to-end unpacked Chrome extension test in `tests/e2e/extension.spec.ts`**

```ts
// tests/e2e/extension.spec.ts
import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test.describe('ClearRead unpacked Chrome extension E2E', () => {
  let context: BrowserContext;
  let userDataDir: string;
  let extensionId: string;

  test.beforeAll(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'clearread-e2e-'));
    const pathToExtension = resolve(process.cwd(), 'dist');

    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    extensionId = serviceWorker.url().split('/')[2];
  });

  test.afterAll(async () => {
    await context?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  });

  test('applies Multi-Sensory profile from onboarding and adapts dark-mode article safely', async () => {
    const onboardingPage = await context.newPage();
    await onboardingPage.goto(`chrome-extension://${extensionId}/onboarding.html`);

    await onboardingPage.locator('[data-profile="heavy"]').click();
    await expect(onboardingPage.locator('#previewBox')).toHaveCSS(
      'background-color',
      'rgb(255, 247, 230)'
    );

    await onboardingPage.evaluate(() => {
      return new Promise<void>((res) => {
        chrome.storage.sync.set(
          {
            enabled: true,
            profile: 'heavy',
            font: 'OpenDyslexic',
            lineHeight: '2.0',
            letterSpacing: '0.08em',
            wordSpacing: '0.18em',
            tintColor: '#FFF7E6',
            rulerEnabled: true,
            ttsMode: 'click',
            hasSeenOnboarding: true
          },
          () => res()
        );
      });
    });

    const articlePage = await context.newPage();
    await articlePage.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <style>
          body { background: #111; color: #eee; }
          main { display: grid; grid-template-columns: 1fr 300px; width: 1100px; }
        </style>
      </head>
      <body>
        <main id="gridLayout">
          <article>
            <p id="p1">ClearRead keeps multi-column layouts intact while fixing crowding.</p>
          </article>
          <aside>Sidebar</aside>
        </main>
      </body>
      </html>
    `);

    await articlePage.addScriptTag({ path: resolve(process.cwd(), 'dist/content.js') });
    await expect(articlePage.locator('#p1')).toHaveCSS('color', 'rgb(31, 31, 31)');
    const mainWidth = await articlePage.locator('#gridLayout').evaluate((el) => el.clientWidth);
    expect(mainWidth).toBe(1100);
  });
});
```

- [ ] **Step 3: Build extension, run unit coverage gate + Playwright E2E suite**

Run: `npm run build && npm run test:coverage && npx playwright install chromium && npm run test:e2e`
Expected: `dist/` populated with bundled extension assets, unit test coverage ≥80%, E2E tests PASS.

- [ ] **Step 4: Commit all build and verification files**

```bash
git add public/manifest.json vite.config.ts vite.content.config.ts playwright.config.ts tests/e2e/extension.spec.ts
git commit -m "feat: add Vite MV3 multi-entry bundler config, manifest, and Playwright E2E tests"
```

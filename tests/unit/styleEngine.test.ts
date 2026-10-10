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

  it('reuses existing style nodes when updating settings and tears down when disabled', () => {
    applyStyles({ ...PROFILES.moderate, hasSeenOnboarding: true });
    const initialFontEl = document.getElementById(FONT_EL_ID);
    const initialStyleEl = document.getElementById(STYLE_EL_ID);

    applyStyles({ ...PROFILES.heavy, hasSeenOnboarding: true });
    expect(document.getElementById(FONT_EL_ID)).toBe(initialFontEl);
    expect(document.getElementById(STYLE_EL_ID)).toBe(initialStyleEl);
    expect(initialStyleEl?.textContent).toContain("font-family: 'OpenDyslexic'");

    applyStyles({ ...DEFAULT_SETTINGS, enabled: false });
    expect(document.getElementById(STYLE_EL_ID)).toBeNull();
  });
});

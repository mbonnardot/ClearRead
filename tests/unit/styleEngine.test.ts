import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';
import {
  FONT_EL_ID,
  STYLE_EL_ID,
  applyStyles,
  teardownStyles
} from '../../src/content/styleEngine';

describe('content styleEngine (v2 non-destructive host styling)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-ext/${path}`
      }
    });
  });

  it('never overrides host background-color or foreground color on containers even with Sepia tint', () => {
    applyStyles({
      ...DEFAULT_SETTINGS,
      ...PROFILES.moderate,
      tintColor: '#FBF0D9',
      fontScale: 115,
      paragraphAlternation: true,
      hasSeenOnboarding: true
    });

    const fontEl = document.getElementById(FONT_EL_ID);
    const styleEl = document.getElementById(STYLE_EL_ID);
    const css = styleEl?.textContent ?? '';
    expect(fontEl).not.toBeNull();
    expect(fontEl?.textContent).toContain('chrome-extension://test-ext/fonts/AtkinsonHyperlegible-Regular.woff2');
    expect(css).toContain('font-family: "Atkinson Hyperlegible"');
    expect(css).toContain('max-width: 75ch !important;');
    expect(css).toContain('zoom: 1.15;');
    expect(css).toContain('p:nth-of-type(even), li:nth-of-type(even), blockquote:nth-of-type(even)');
    expect(css).toContain('border-left: 3px solid rgba(11, 87, 208, 0.45) !important;');

    // Non-destructive guarantee: NEVER emit background-color: #FBF0D9 !important on host containers
    expect(css).not.toContain('background-color: #FBF0D9');
    expect(css).not.toMatch(/div:not\(\[id\^="clearread"\]\)/);
  });

  it('tears down styles immediately when current domain is in excludedDomains', () => {
    applyStyles(
      { ...DEFAULT_SETTINGS, enabled: true, excludedDomains: ['app.internal.example'] },
      'app.internal.example'
    );
    expect(document.getElementById(STYLE_EL_ID)).toBeNull();
  });

  it('removes prose styles cleanly on teardownStyles', () => {
    applyStyles({ ...DEFAULT_SETTINGS, enabled: true });
    expect(document.getElementById(STYLE_EL_ID)).not.toBeNull();

    teardownStyles();
    expect(document.getElementById(STYLE_EL_ID)).toBeNull();
  });

  it('reuses existing style nodes when updating settings and tears down when disabled', () => {
    applyStyles({ ...DEFAULT_SETTINGS, ...PROFILES.moderate, hasSeenOnboarding: true });
    const initialFontEl = document.getElementById(FONT_EL_ID);
    const initialStyleEl = document.getElementById(STYLE_EL_ID);

    applyStyles({ ...DEFAULT_SETTINGS, ...PROFILES.heavy, hasSeenOnboarding: true });
    expect(document.getElementById(FONT_EL_ID)).toBe(initialFontEl);
    expect(document.getElementById(STYLE_EL_ID)).toBe(initialStyleEl);
    expect(initialStyleEl?.textContent).toContain('font-family: "OpenDyslexic"');

    applyStyles({ ...DEFAULT_SETTINGS, enabled: false });
    expect(document.getElementById(STYLE_EL_ID)).toBeNull();
  });
});

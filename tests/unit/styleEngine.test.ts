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

  it('injects offline @font-face declarations, broader prose/heading selectors, and leaf-only 75ch max-width', () => {
    applyStyles({ ...PROFILES.moderate, hasSeenOnboarding: true });

    const fontEl = document.getElementById(FONT_EL_ID);
    const styleEl = document.getElementById(STYLE_EL_ID);
    const css = styleEl?.textContent ?? '';
    expect(fontEl).not.toBeNull();
    expect(fontEl?.textContent).toContain('chrome-extension://test-ext/fonts/AtkinsonHyperlegible-Regular.woff2');
    expect(styleEl).not.toBeNull();
    expect(css).toContain("font-family: 'Atkinson Hyperlegible'");
    expect(css).toContain('[role="article"] p');
    expect(css).toContain('article div:not(:has(div, p, ul, ol, table, section, article, aside, header, footer, nav))');
    expect(css).toContain('p span, li span, a, strong, em, b, u, small, mark, time');
    expect(css).toMatch(/p,\s*li,\s*dd,\s*dt,\s*blockquote\s*\{\s*max-width:\s*75ch\s*!important;\s*\}/);
    expect(css).not.toMatch(/main.*max-width/s);
    expect(css).toContain('color: #1F1F1F !important;');
    expect(css).toContain('::highlight(clearread-sentence)');
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

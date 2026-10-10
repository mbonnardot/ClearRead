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
    p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6, td, th, figcaption, label, summary, [role="article"] p, article div:not(:has(div, p, ul, ol, table, section, article, aside, header, footer, nav)) {
      font-family: '${settings.font}', -apple-system, BlinkMacSystemFont, sans-serif !important;
      line-height: ${settings.lineHeight} !important;
      letter-spacing: ${settings.letterSpacing} !important;
      word-spacing: ${settings.wordSpacing} !important;
      text-align: left !important;
    }
    p span, li span, a, strong, em, b, u, small, mark, time {
      font-family: inherit !important;
      letter-spacing: inherit !important;
      word-spacing: inherit !important;
    }
    p, li, dd, dt, blockquote {
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

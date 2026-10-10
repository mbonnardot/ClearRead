import { isDomainExcluded } from '../shared/storage';
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

export function applyStyles(
  settings: ClearReadSettings,
  hostname: string = window.location.hostname,
  doc: Document = document
): void {
  if (!settings.enabled || isDomainExcluded(hostname, settings.excludedDomains)) {
    teardownStyles(doc);
    return;
  }

  let fontStyle = doc.getElementById(FONT_EL_ID);
  if (fontStyle == null) {
    fontStyle = doc.createElement('style');
    fontStyle.id = FONT_EL_ID;
    fontStyle.textContent = buildFontFaceCss();
    doc.head.appendChild(fontStyle);
  }

  let proseStyle = doc.getElementById(STYLE_EL_ID);
  if (proseStyle == null) {
    proseStyle = doc.createElement('style');
    proseStyle.id = STYLE_EL_ID;
    doc.head.appendChild(proseStyle);
  }

  const zoomRule = settings.fontScale !== 100 ? `zoom: ${settings.fontScale / 100};` : '';
  const alternationRule = settings.paragraphAlternation
    ? `
    p:nth-of-type(even), li:nth-of-type(even), blockquote:nth-of-type(even) {
      border-left: 3px solid rgba(11, 87, 208, 0.45) !important;
      padding-left: 10px !important;
    }
  `
    : '';

  proseStyle.textContent = `
    p, p *:not(code):not(pre):not(kbd):not(samp):not(svg):not([class*="icon"]):not([class*="fa-"]), li, li *:not(code):not(pre):not(kbd):not(samp):not(svg):not([class*="icon"]):not([class*="fa-"]), dd, dt, blockquote, h1, h2, h3, h4, h5, h6, td, th {
      font-family: "${settings.font}", -apple-system, BlinkMacSystemFont, sans-serif !important;
      line-height: ${settings.lineHeight} !important;
      letter-spacing: ${settings.letterSpacing} !important;
      word-spacing: ${settings.wordSpacing} !important;
      text-align: left !important;
    }
    p, li, dd, dt, blockquote {
      max-width: 75ch !important;
      ${zoomRule}
    }
    ${alternationRule}
    code, pre, kbd, samp, svg, i, [class*="icon"], [class*="fa-"] {
      font-family: inherit !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
    ::highlight(clearread-sentence) {
      background-color: rgba(255, 235, 59, 0.35);
    }
    ::highlight(clearread-word) {
      background-color: #ffe082;
      color: #1f1f1f;
    }
  `;
}

export function teardownStyles(doc: Document = document): void {
  doc.getElementById(STYLE_EL_ID)?.remove();
}

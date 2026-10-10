import { Readability } from '@mozilla/readability';
import { enrichElementText } from '../shared/textTransforms';
import type { ClearReadSettings } from '../shared/types';
import { OVERLAY_HOST_ID } from './overlayHost';

export const READER_HOST_ID = 'clearread-reader-host';
export const READER_DIALOG_ID = 'clearread-reader-dialog';

export interface ReaderViewOptions {
  readonly initialSettings: ClearReadSettings;
  onUpdateSettings(partial: Partial<ClearReadSettings>): void;
  onSpeakArticle(): void;
}

export interface ReaderViewController {
  open(): boolean;
  close(): void;
  toggle(): boolean;
  isOpen(): boolean;
  updateSettings(settings: ClearReadSettings): void;
  getArticleRoot(): HTMLElement | null;
  destroy(): void;
}

const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'CODE',
  'STRONG',
  'EM',
  'B',
  'I',
  'A',
  'FIGURE',
  'FIGCAPTION',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'IMG',
  'BR'
]);

const BLOCKED_TAGS: ReadonlySet<string> = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'NOSCRIPT',
  'SVG',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT'
]);

const FONT_FILE_ENTRIES: ReadonlyArray<{ readonly family: string; readonly file: string }> = [
  { family: 'Lexend', file: 'Lexend-Regular.woff2' },
  { family: 'Atkinson Hyperlegible', file: 'AtkinsonHyperlegible-Regular.woff2' },
  { family: 'OpenDyslexic', file: 'OpenDyslexic-Regular.woff2' }
];

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function appendSanitizedNodes(sourceParent: ParentNode, targetParent: HTMLElement): void {
  const doc = targetParent.ownerDocument;
  for (const child of Array.from(sourceParent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && child.nodeValue) {
      targetParent.appendChild(doc.createTextNode(child.nodeValue));
      continue;
    }

    if (!(child instanceof Element)) continue;
    const tag = child.tagName.toUpperCase();
    if (BLOCKED_TAGS.has(tag)) continue;

    if (ALLOWED_TAGS.has(tag)) {
      const cleanEl = doc.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const href = child.getAttribute('href');
        if (href && isSafeHttpUrl(href)) {
          cleanEl.setAttribute('href', href);
          cleanEl.setAttribute('target', '_blank');
          cleanEl.setAttribute('rel', 'noopener noreferrer');
        }
      } else if (tag === 'IMG') {
        const src = child.getAttribute('src');
        if (!src || !isSafeHttpUrl(src)) continue;
        cleanEl.setAttribute('src', src);
        const alt = child.getAttribute('alt');
        if (alt) cleanEl.setAttribute('alt', alt);
      }
      appendSanitizedNodes(child, cleanEl);
      targetParent.appendChild(cleanEl);
    } else {
      appendSanitizedNodes(child, targetParent);
    }
  }
}

function buildReaderCss(settings: ClearReadSettings): string {
  const fontFaces = FONT_FILE_ENTRIES.map((entry) => {
    const url = chrome.runtime.getURL(`fonts/${entry.file}`);
    return `@font-face { font-family: "${entry.family}"; src: url("${url}") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }`;
  }).join('\n');

  const basePx = Math.round(18 * (settings.fontScale / 100));
  const alternationRule = settings.paragraphAlternation
    ? `.cr-reader-article p:nth-of-type(even),
       .cr-reader-article li:nth-of-type(even),
       .cr-reader-article blockquote:nth-of-type(even) {
         border-left: 3px solid rgba(11, 87, 208, 0.45);
         padding-left: 12px;
       }`
    : '';

  return `
    ${fontFaces}
    :host {
      all: initial;
    }
    dialog#${READER_DIALOG_ID} {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      max-width: 100vw;
      max-height: 100vh;
      margin: 0;
      padding: 0;
      border: none;
      background: rgba(15, 18, 24, 0.72);
      z-index: 2147483640;
      overflow-y: auto;
      box-sizing: border-box;
    }
    .cr-reader-toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 24px;
      background: #f8f9ff;
      color: #191c20;
      border-bottom: 1px solid #c3c6cf;
      font-family: "Lexend", system-ui, sans-serif;
    }
    .cr-reader-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 45vw;
    }
    .cr-reader-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cr-reader-btn {
      padding: 6px 12px;
      border-radius: 9999px;
      border: 1px solid #c3c6cf;
      background: #ffffff;
      color: #191c20;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .cr-reader-btn[aria-pressed="true"] {
      background: #d3e3fd;
      color: #041e49;
      border-color: #0b57d0;
    }
    .cr-reader-btn:focus-visible {
      outline: 2px solid #0b57d0;
      outline-offset: 2px;
    }
    .cr-reader-article {
      max-width: 68ch;
      margin: 28px auto 80px;
      padding: 40px 48px;
      border-radius: 16px;
      background-color: ${settings.tintColor};
      color: #1f1f1f;
      font-family: "${settings.font}", system-ui, sans-serif;
      font-size: ${basePx}px;
      line-height: ${settings.lineHeight};
      letter-spacing: ${settings.letterSpacing};
      word-spacing: ${settings.wordSpacing};
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28);
    }
    .cr-reader-article a {
      color: #0b57d0;
    }
    strong.cr-bionic {
      font-weight: 700;
    }
    ${alternationRule}
  `;
}

function createToolbarButton(
  doc: Document,
  id: string,
  label: string,
  pressed?: boolean
): HTMLButtonElement {
  const btn = doc.createElement('button');
  btn.id = id;
  btn.type = 'button';
  btn.className = 'cr-reader-btn';
  btn.textContent = label;
  if (pressed !== undefined) {
    btn.setAttribute('aria-pressed', String(pressed));
  }
  return btn;
}

export function createReaderViewController(options: ReaderViewOptions): ReaderViewController {
  let settings: ClearReadSettings = { ...options.initialSettings };
  let lastActiveElement: HTMLElement | null = null;

  const host = document.createElement('div');
  host.id = READER_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  const dialog = document.createElement('dialog');
  dialog.id = READER_DIALOG_ID;
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'clearread-reader-title');

  const toolbar = document.createElement('header');
  toolbar.className = 'cr-reader-toolbar';

  const titleEl = document.createElement('h1');
  titleEl.id = 'clearread-reader-title';
  titleEl.className = 'cr-reader-title';
  titleEl.textContent = 'Reader View';

  const controls = document.createElement('div');
  controls.className = 'cr-reader-controls';

  const bionicBtn = createToolbarButton(document, 'cr-reader-bionic', 'Bionic', settings.bionicReading);
  const syllablesBtn = createToolbarButton(document, 'cr-reader-syllables', 'Syllables', settings.syllableDots);
  const rulerBtn = createToolbarButton(document, 'cr-reader-ruler', 'Focus Mask', settings.rulerEnabled);
  const ttsBtn = createToolbarButton(document, 'cr-reader-tts', '🔊 Read Aloud');
  const closeBtn = createToolbarButton(document, 'clearread-reader-close', '✕ Close');
  closeBtn.setAttribute('aria-label', 'Close Reader View');

  controls.append(bionicBtn, syllablesBtn, rulerBtn, ttsBtn, closeBtn);
  toolbar.append(titleEl, controls);

  const articleEl = document.createElement('article');
  articleEl.id = 'clearread-reader-article';
  articleEl.className = 'cr-reader-article';

  dialog.append(toolbar, articleEl);
  shadow.append(styleEl, dialog);

  const renderVisualState = (): void => {
    styleEl.textContent = buildReaderCss(settings);
    bionicBtn.setAttribute('aria-pressed', String(settings.bionicReading));
    syllablesBtn.setAttribute('aria-pressed', String(settings.syllableDots));
    rulerBtn.setAttribute('aria-pressed', String(settings.rulerEnabled));
    enrichElementText(articleEl, {
      bionic: settings.bionicReading,
      syllables: settings.syllableDots
    });
  };

  const extractIntoArticle = (): void => {
    while (articleEl.firstChild) {
      articleEl.removeChild(articleEl.firstChild);
    }

    const cloned = document.cloneNode(true);
    let parsed: ReturnType<Readability['parse']> = null;
    if (cloned instanceof Document) {
      cloned.getElementById(OVERLAY_HOST_ID)?.remove();
      cloned.getElementById(READER_HOST_ID)?.remove();
      parsed = new Readability(cloned).parse();
    }

    if (parsed && parsed.content) {
      titleEl.textContent = parsed.title || document.title || 'Reader View';
      const parsedDoc = new DOMParser().parseFromString(parsed.content, 'text/html');
      appendSanitizedNodes(parsedDoc.body, articleEl);
    } else {
      titleEl.textContent = document.title || 'Reader View';
      const fallbackRoot = document.querySelector('article, main, [role="main"]') ?? document.body;
      appendSanitizedNodes(fallbackRoot, articleEl);
    }
  };

  const close = (): void => {
    if (!dialog.hasAttribute('open')) return;
    dialog.removeAttribute('open');
    lastActiveElement?.focus();
    lastActiveElement = null;
  };

  const open = (): boolean => {
    if (!host.isConnected) {
      document.documentElement.appendChild(host);
    }
    lastActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    extractIntoArticle();
    renderVisualState();
    dialog.setAttribute('open', '');
    closeBtn.focus();
    return true;
  };

  bionicBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextVal = !settings.bionicReading;
    settings = { ...settings, bionicReading: nextVal };
    renderVisualState();
    options.onUpdateSettings({ bionicReading: nextVal });
  });

  syllablesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextVal = !settings.syllableDots;
    settings = { ...settings, syllableDots: nextVal };
    renderVisualState();
    options.onUpdateSettings({ syllableDots: nextVal });
  });

  rulerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextVal = !settings.rulerEnabled;
    settings = { ...settings, rulerEnabled: nextVal };
    renderVisualState();
    options.onUpdateSettings({ rulerEnabled: nextVal });
  });

  ttsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    options.onSpeakArticle();
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      close();
    }
  });

  dialog.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href]'));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = shadow.activeElement;

      if (e.shiftKey) {
        if (active === first || !(active instanceof HTMLElement) || !focusables.includes(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !(active instanceof HTMLElement) || !focusables.includes(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  return {
    open,
    close,
    toggle(): boolean {
      if (dialog.hasAttribute('open')) {
        close();
        return false;
      }
      return open();
    },
    isOpen(): boolean {
      return dialog.hasAttribute('open');
    },
    updateSettings(nextSettings: ClearReadSettings): void {
      settings = { ...nextSettings };
      if (dialog.hasAttribute('open')) {
        renderVisualState();
      }
    },
    getArticleRoot(): HTMLElement | null {
      return dialog.hasAttribute('open') ? articleEl : null;
    },
    destroy(): void {
      close();
      host.remove();
    }
  };
}

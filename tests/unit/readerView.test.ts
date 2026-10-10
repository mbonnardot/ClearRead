import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  READER_DIALOG_ID,
  READER_HOST_ID,
  createReaderViewController
} from '../../src/content/readerView';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';

describe('content readerView (Shadow DOM Readability Modal, Sanitizer, Focus Trap & Aids)', () => {
  beforeEach(() => {
    document.head.innerHTML = '<title>Understanding Dyslexia Typography</title>';
    document.body.innerHTML = `
      <nav>Cluttered Header Navigation</nav>
      <button id="launch-reader-btn" type="button">Open Reader</button>
      <main>
        <article>
          <h1>Understanding Dyslexia Typography</h1>
          <p>Comprehension improves significantly when generous spacing and warm paper tints reduce visual crowding across long paragraphs of academic reading material.</p>
          <p>Researchers demonstrated that structured typography helps readers track complex multisyllabic vocabulary with far less visual fatigue during extended study sessions.</p>
          <p onclick="window.__hacked = true"><script>window.__scriptExecuted = true;</script><a href="javascript:alert(1)">Unsafe Link</a> and <a href="https://example.org/study">Safe Study Link</a>.</p>
        </article>
      </main>
    `;

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-ext/${path}`
      }
    });
  });

  afterEach(() => {
    document.getElementById(READER_HOST_ID)?.remove();
    document.body.innerHTML = '';
  });

  it('extracts clean Readability article, sanitizes XSS vectors, applies Bionic + Syllables, traps Tab focus, and restores focus on close', () => {
    const onUpdateSettings = vi.fn();
    const onSpeakArticle = vi.fn();

    const triggerBtn = document.getElementById('launch-reader-btn') as HTMLButtonElement;
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    const reader = createReaderViewController({
      initialSettings: {
        ...DEFAULT_SETTINGS,
        ...PROFILES.heavy,
        bionicReading: true,
        syllableDots: true,
        paragraphAlternation: true,
        fontScale: 115,
        hasSeenOnboarding: true
      },
      onUpdateSettings,
      onSpeakArticle
    });

    expect(reader.isOpen()).toBe(false);
    const opened = reader.open();
    expect(opened).toBe(true);
    expect(reader.isOpen()).toBe(true);

    const host = document.getElementById(READER_HOST_ID)!;
    const shadow = host.shadowRoot!;
    const dialog = shadow.getElementById(READER_DIALOG_ID) as HTMLDialogElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('clearread-reader-title');

    const articleEl = reader.getArticleRoot()!;
    expect(articleEl).not.toBeNull();
    expect(articleEl.querySelector('script')).toBeNull();
    expect(articleEl.querySelector('[onclick]')).toBeNull();
    expect(articleEl.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(articleEl.querySelector('a[href="https://example.org/study"]')).not.toBeNull();
    expect(articleEl.querySelectorAll('strong.cr-bionic').length).toBeGreaterThan(0);
    expect(articleEl.textContent).toContain('·');

    // Toolbar toggles emit immutable setting updates and speak article callback
    const bionicBtn = shadow.getElementById('cr-reader-bionic') as HTMLButtonElement;
    bionicBtn.click();
    expect(onUpdateSettings).toHaveBeenCalledWith({ bionicReading: false });

    const ttsBtn = shadow.getElementById('cr-reader-tts') as HTMLButtonElement;
    ttsBtn.click();
    expect(onSpeakArticle).toHaveBeenCalledTimes(1);

    // Focus trap cycles Tab from last focusable element back to first button
    const closeBtn = shadow.getElementById('clearread-reader-close') as HTMLButtonElement;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, a[href]')
    );
    const lastFocusable = focusables.at(-1)!;
    lastFocusable.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(shadow.activeElement).toBe(focusables[0]);

    // Closing restores focus to original trigger button
    closeBtn.click();
    expect(reader.isOpen()).toBe(false);
    expect(document.activeElement).toBe(triggerBtn);

    reader.destroy();
    expect(document.getElementById(READER_HOST_ID)).toBeNull();
  });

  it('falls back gracefully to main/body prose when Readability returns null', () => {
    document.body.innerHTML = `<main><p>Short note paragraph.</p></main>`;
    const reader = createReaderViewController({
      initialSettings: DEFAULT_SETTINGS,
      onUpdateSettings: vi.fn(),
      onSpeakArticle: vi.fn()
    });

    expect(reader.toggle()).toBe(true);
    expect(reader.getArticleRoot()?.textContent).toContain('Short note paragraph.');
    expect(reader.toggle()).toBe(false);
    reader.destroy();
  });
});

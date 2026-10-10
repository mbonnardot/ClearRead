import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initBackground } from '../../src/background/index';
import { initContentScript } from '../../src/content/index';
import { OVERLAY_HOST_ID } from '../../src/content/overlayHost';
import { STYLE_EL_ID } from '../../src/content/styleEngine';
import { createTtsController } from '../../src/content/ttsEngine';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';

class FakeHighlight {
  readonly ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

interface FakeUtterance {
  text: string;
  rate: number;
  onstart: (() => void) | null;
  onboundary: ((e: { name: string; charIndex: number; charLength?: number }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

describe('content ttsEngine, content orchestrator & background worker', () => {
  let utterances: FakeUtterance[];
  let highlightMap: Map<string, FakeHighlight>;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = `<p id="target">Hello world. Second sentence here.</p>`;
    document.getElementById(OVERLAY_HOST_ID)?.remove();
    utterances = [];
    highlightMap = new Map();

    vi.stubGlobal('Highlight', FakeHighlight);
    Object.defineProperty(globalThis, 'CSS', {
      value: { highlights: highlightMap },
      configurable: true
    });

    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class implements FakeUtterance {
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
      speak: vi.fn((u: FakeUtterance) => {
        u.onstart?.();
      })
    });
  });

  it('highlights active sentence and words via CSS.highlights, handles errors/end, and clears on stop', () => {
    const statuses: string[] = [];
    const tts = createTtsController({
      setTtsStatus: (s) => statuses.push(s)
    });

    // togglePause while inactive should no-op
    tts.togglePause();
    expect(window.speechSynthesis.pause).not.toHaveBeenCalled();

    const p = document.getElementById('target');
    if (!p) throw new Error('missing target');
    tts.setRate(1.25);
    tts.speakBlock(p);

    expect(statuses[0]).toBe('speaking');
    expect(utterances[0].text).toBe('Hello world.');
    expect(utterances[0].rate).toBe(1.25);
    expect(highlightMap.get('clearread-sentence')?.ranges[0].toString()).toBe('Hello world.');

    // Non-word boundary is ignored
    utterances[0].onboundary?.({ name: 'sentence', charIndex: 0 });
    expect(highlightMap.has('clearread-word')).toBe(false);

    // Word boundary highlights word
    utterances[0].onboundary?.({ name: 'word', charIndex: 6, charLength: 5 });
    expect(highlightMap.get('clearread-word')?.ranges[0].toString()).toBe('world');

    // End of first sentence advances to second sentence
    utterances[0].onend?.();
    expect(utterances[1].text).toBe('Second sentence here.');

    tts.togglePause();
    expect(window.speechSynthesis.pause).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('paused');

    tts.togglePause();
    expect(window.speechSynthesis.resume).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('speaking');

    // End of final sentence finishes cleanly
    utterances[1].onend?.();
    expect(highlightMap.size).toBe(0);
    expect(statuses.at(-1)).toBe('hidden');

    // Error callback stops cleanly
    tts.speakBlock(p);
    utterances[2].onerror?.();
    expect(statuses.at(-1)).toBe('hidden');

    // Empty block safely clears and sets status to hidden without speaking
    const emptyBlock = document.createElement('p');
    tts.speakBlock(emptyBlock);
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

  it('orchestrates content script state sync, alt-click playback, Escape stop, and cleanup', async () => {
    let storedSettings: Record<string, unknown> = {
      ...DEFAULT_SETTINGS,
      ...PROFILES.moderate,
      enabled: true,
      hasSeenOnboarding: true
    };
    const changeListeners: Array<
      (changes: Record<string, chrome.storage.StorageChange>, area: string) => void
    > = [];

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id/${path}`
      },
      storage: {
        sync: {
          get: vi.fn((defaults: Record<string, unknown>, cb: (res: Record<string, unknown>) => void) => {
            cb({ ...defaults, ...storedSettings });
          })
        },
        onChanged: {
          addListener: vi.fn((fn) => changeListeners.push(fn)),
          removeListener: vi.fn((fn) => {
            const idx = changeListeners.indexOf(fn);
            if (idx >= 0) changeListeners.splice(idx, 1);
          })
        }
      }
    });

    const cleanup = await initContentScript();

    // Initial state applied styles and created overlay host
    expect(document.getElementById(STYLE_EL_ID)).not.toBeNull();
    const host = document.getElementById(OVERLAY_HOST_ID)!;
    expect(host).not.toBeNull();

    // Alt+Click on paragraph starts TTS and prevents default action
    const p = document.getElementById('target')!;
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true });
    const preventSpy = vi.spyOn(clickEvent, 'preventDefault');
    p.dispatchEvent(clickEvent);

    expect(preventSpy).toHaveBeenCalled();
    expect(utterances).toHaveLength(1);
    expect(utterances[0].text).toBe('Hello world.');

    // Overlay pause button toggles pause
    const pauseBtn = host.shadowRoot!.getElementById('clearread-tts-pause') as HTMLButtonElement;
    pauseBtn.click();
    expect(window.speechSynthesis.pause).toHaveBeenCalledTimes(1);

    // Overlay stop button stops TTS
    const stopBtn = host.shadowRoot!.getElementById('clearread-tts-stop') as HTMLButtonElement;
    stopBtn.click();
    expect(highlightMap.size).toBe(0);

    // Start again and press Escape to stop
    p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }));
    expect(utterances).toHaveLength(2);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(highlightMap.size).toBe(0);

    // Sync update setting ttsMode to 'off' stops active speech
    p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }));
    expect(utterances).toHaveLength(3);
    storedSettings = { ...storedSettings, ttsMode: 'off' };
    for (const listener of changeListeners) {
      listener({}, 'sync');
    }
    await Promise.resolve();
    expect(highlightMap.size).toBe(0);

    // Sync update setting enabled to false tears down styles
    storedSettings = { ...storedSettings, enabled: false };
    for (const listener of changeListeners) {
      listener({}, 'sync');
    }
    await Promise.resolve();
    expect(document.getElementById(STYLE_EL_ID)).toBeNull();

    // Click while disabled does nothing
    p.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    expect(utterances).toHaveLength(3);

    // Cleanup tears down everything cleanly
    cleanup();
    expect(document.getElementById(OVERLAY_HOST_ID)).toBeNull();
    expect(changeListeners).toHaveLength(0);
  });
});

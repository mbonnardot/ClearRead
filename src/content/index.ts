import { getSettings, isDomainExcluded, subscribeSettings, updateSettings } from '../shared/storage';
import type { ClearReadSettings } from '../shared/types';
import { createOverlayController, detectPdfPage } from './overlayHost';
import { createReaderViewController } from './readerView';
import { applyStyles, teardownStyles } from './styleEngine';
import { shouldTriggerTts } from './textMapper';
import { createTtsController } from './ttsEngine';

declare global {
  interface Window {
    __clearReadCleanup?: () => void;
  }
}

interface ToggleReaderMessage {
  readonly type: 'CLEARREAD_TOGGLE_READER';
}

function isToggleReaderMessage(msg: unknown): msg is ToggleReaderMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as { type?: unknown }).type === 'CLEARREAD_TOGGLE_READER'
  );
}

export async function initContentScript(): Promise<() => void> {
  window.__clearReadCleanup?.();

  let state: ClearReadSettings = await getSettings();

  const overlay = createOverlayController({
    onTogglePause: () => tts.togglePause(),
    onStop: () => tts.stop()
  });
  const tts = createTtsController(overlay);

  const readerView = createReaderViewController({
    initialSettings: state,
    onUpdateSettings: (partial) => {
      void updateSettings(partial);
    },
    onSpeakArticle: () => {
      const root = readerView.getArticleRoot();
      const firstBlock = root?.querySelector<HTMLElement>('p, li, blockquote, h1, h2') ?? root;
      if (firstBlock) {
        tts.speakBlock(firstBlock);
      }
    }
  });

  const syncState = (next: ClearReadSettings): void => {
    state = next;
    tts.setRate(state.ttsRate);
    overlay.updatePdfBanner(detectPdfPage(document, window.location), window.location.href);
    readerView.updateSettings(state);

    const activeOnSite = state.enabled && !isDomainExcluded(window.location.hostname, state.excludedDomains);
    if (activeOnSite) {
      applyStyles(state);
      overlay.setTintColor(state.tintColor);
      overlay.setRulerConfig(state.rulerEnabled, state.rulerStyle);
      if (state.ttsMode === 'off') {
        tts.stop();
      }
    } else {
      teardownStyles();
      overlay.setTintColor(null);
      overlay.setRulerConfig(false, state.rulerStyle);
      tts.stop();
    }
  };

  syncState(state);
  const unsubscribe = subscribeSettings(syncState);

  const onClick = (event: MouseEvent): void => {
    const activeOnSite = state.enabled && !isDomainExcluded(window.location.hostname, state.excludedDomains);
    if (!activeOnSite && !readerView.isOpen()) return;
    const block = shouldTriggerTts(event, state.ttsMode);
    if (!block) return;
    if (event.altKey) {
      event.preventDefault();
    }
    tts.speakBlock(block);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      readerView.toggle();
      return;
    }
    if (event.key === 'Escape') {
      tts.stop();
    }
  };

  const onMessage = (
    msg: unknown,
    _sender: unknown,
    sendResponse: (response: { open: boolean }) => void
  ): boolean | undefined => {
    if (isToggleReaderMessage(msg)) {
      const open = readerView.toggle();
      sendResponse({ open });
      return true;
    }
    return undefined;
  };

  window.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);
  chrome.runtime?.onMessage?.addListener(onMessage);

  const cleanup = (): void => {
    unsubscribe();
    window.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKeyDown);
    chrome.runtime?.onMessage?.removeListener(onMessage);
    tts.stop();
    readerView.destroy();
    overlay.destroy();
    teardownStyles();
  };

  window.__clearReadCleanup = cleanup;
  return cleanup;
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  void initContentScript();
}

import { getSettings, subscribeSettings } from '../shared/storage';
import type { ClearReadSettings } from '../shared/types';
import { createOverlayController } from './overlayHost';
import { applyStyles, teardownStyles } from './styleEngine';
import { shouldTriggerTts } from './textMapper';
import { createTtsController } from './ttsEngine';

declare global {
  interface Window {
    __clearReadCleanup?: () => void;
  }
}

export async function initContentScript(): Promise<() => void> {
  window.__clearReadCleanup?.();

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
      overlay.setTintColor(state.tintColor);
      overlay.setRulerEnabled(state.rulerEnabled);
      if (state.ttsMode === 'off') {
        tts.stop();
      }
    } else {
      teardownStyles();
      overlay.setTintColor(null);
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

  const cleanup = () => {
    unsubscribe();
    window.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKeyDown);
    tts.stop();
    overlay.destroy();
    teardownStyles();
  };

  window.__clearReadCleanup = cleanup;
  return cleanup;
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  void initContentScript();
}

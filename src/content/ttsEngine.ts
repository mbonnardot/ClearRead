import type { TtsRate } from '../shared/types';
import type { OverlayController } from './overlayHost';
import { createWordRange, extractSentenceSegments, type SentenceSegment } from './textMapper';

export interface TtsController {
  speakBlock(block: HTMLElement): void;
  togglePause(): void;
  stop(): void;
  setRate(rate: TtsRate): void;
}

const SENTENCE_HIGHLIGHT = 'clearread-sentence';
const WORD_HIGHLIGHT = 'clearread-word';

function setHighlightRange(name: string, range: Range | null): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS) || typeof Highlight === 'undefined') {
    return;
  }
  if (!range) {
    CSS.highlights.delete(name);
    return;
  }
  CSS.highlights.set(name, new Highlight(range));
}

function clearAllHighlights(): void {
  if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
    CSS.highlights.delete(SENTENCE_HIGHLIGHT);
    CSS.highlights.delete(WORD_HIGHLIGHT);
  }
}

export function createTtsController(
  overlay: Pick<OverlayController, 'setTtsStatus'>,
  doc: Document = document
): TtsController {
  let sessionId = 0;
  let paused = false;
  let active = false;
  let rate: TtsRate = 1;

  const resetPlayback = () => {
    sessionId += 1;
    paused = false;
    active = false;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearAllHighlights();
  };

  const stop = () => {
    resetPlayback();
    overlay.setTtsStatus('hidden');
  };

  const speakSegmentAt = (
    segments: readonly SentenceSegment[],
    index: number,
    currentSession: number
  ) => {
    if (currentSession !== sessionId || index >= segments.length || !('speechSynthesis' in window)) {
      stop();
      return;
    }

    const segment = segments[index];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.rate = rate;

    utterance.onstart = () => {
      if (currentSession !== sessionId) return;
      setHighlightRange(SENTENCE_HIGHLIGHT, segment.range);
      setHighlightRange(WORD_HIGHLIGHT, null);
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (currentSession !== sessionId || event.name !== 'word') return;
      const wordRange = createWordRange(segment, event.charIndex, event.charLength);
      setHighlightRange(WORD_HIGHLIGHT, wordRange);
    };

    utterance.onend = () => {
      if (currentSession !== sessionId) return;
      speakSegmentAt(segments, index + 1, currentSession);
    };

    utterance.onerror = () => {
      if (currentSession !== sessionId) return;
      stop();
    };

    window.speechSynthesis.speak(utterance);
  };

  return {
    speakBlock(block: HTMLElement) {
      if (!('speechSynthesis' in window)) return;
      resetPlayback();
      const segments = extractSentenceSegments(block, doc.documentElement.lang || 'en');
      if (segments.length === 0) {
        overlay.setTtsStatus('hidden');
        return;
      }

      active = true;
      paused = false;
      const currentSession = sessionId;
      overlay.setTtsStatus('speaking');
      speakSegmentAt(segments, 0, currentSession);
    },

    togglePause() {
      if (!active || !('speechSynthesis' in window)) return;
      if (paused) {
        window.speechSynthesis.resume();
        paused = false;
        overlay.setTtsStatus('speaking');
      } else {
        window.speechSynthesis.pause();
        paused = true;
        overlay.setTtsStatus('paused');
      }
    },

    stop,

    setRate(newRate: TtsRate) {
      rate = newRate;
    }
  };
}

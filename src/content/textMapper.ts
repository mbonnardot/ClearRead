// src/content/textMapper.ts
import type { TtsMode } from '../shared/types';

export interface TextNodeSlice {
  readonly node: Text;
  readonly start: number;
  readonly end: number;
}

export interface SentenceSegment {
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly range: Range;
  readonly slices: readonly TextNodeSlice[];
}

const READABLE_SELECTOR = 'p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6';
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, summary, [role="button"]';

export function findReadableBlock(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const block = target.closest(READABLE_SELECTOR);
  return block instanceof HTMLElement ? block : null;
}

export function shouldTriggerTts(event: MouseEvent, ttsMode: TtsMode): HTMLElement | null {
  if (ttsMode === 'off') return null;
  if (ttsMode === 'alt-click' && !event.altKey) return null;

  if (!event.altKey && event.target instanceof Element) {
    if (event.target.closest(INTERACTIVE_SELECTOR)) return null;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return null;
  }

  return findReadableBlock(event.target);
}

function resolvePosition(
  slices: readonly TextNodeSlice[],
  charOffset: number
): { node: Text; offset: number } {
  for (const slice of slices) {
    if (charOffset <= slice.end) {
      return {
        node: slice.node,
        offset: Math.max(0, Math.min(slice.node.length, charOffset - slice.start))
      };
    }
  }
  const last = slices[slices.length - 1];
  return { node: last.node, offset: last.node.length };
}

const IGNORED_TEXT_PARENT_SELECTOR = 'script, style, noscript, [hidden], [aria-hidden="true"]';

function createSentenceSegmenter(lang: string): Intl.Segmenter {
  try {
    return new Intl.Segmenter(lang, { granularity: 'sentence' });
  } catch {
    return new Intl.Segmenter('en', { granularity: 'sentence' });
  }
}

export function extractSentenceSegments(
  block: HTMLElement,
  lang: string = document.documentElement.lang || 'en'
): SentenceSegment[] {
  const doc = block.ownerDocument;
  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const slices: TextNodeSlice[] = [];
  let cursor = 0;

  let current = walker.nextNode();
  while (current) {
    if (
      current instanceof Text &&
      current.data.length > 0 &&
      !current.parentElement?.closest(IGNORED_TEXT_PARENT_SELECTOR)
    ) {
      slices.push({
        node: current,
        start: cursor,
        end: cursor + current.data.length
      });
      cursor += current.data.length;
    }
    current = walker.nextNode();
  }

  if (slices.length === 0) return [];

  const fullText = slices.map((s) => s.node.data).join('');
  if (fullText.trim().length < 2) return [];

  const segmenter = createSentenceSegmenter(lang);
  const segments: SentenceSegment[] = [];

  for (const item of segmenter.segment(fullText)) {
    const trimmed = item.segment.trim();
    if (!trimmed) continue;

    const leadingSpaces = item.segment.indexOf(trimmed);
    const startOffset = item.index + leadingSpaces;
    const endOffset = startOffset + trimmed.length;

    const startPos = resolvePosition(slices, startOffset);
    const endPos = resolvePosition(slices, endOffset);

    const range = doc.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    segments.push({
      text: trimmed,
      startOffset,
      endOffset,
      range,
      slices
    });
  }

  return segments;
}

export function createWordRange(
  segment: SentenceSegment,
  charIndex: number,
  charLength?: number
): Range | null {
  if (charIndex < 0 || charIndex >= segment.text.length) return null;

  const length =
    charLength && charLength > 0
      ? charLength
      : (segment.text.slice(charIndex).match(/^\S+/)?.[0].length ?? 0);

  if (length <= 0) return null;

  const absStart = segment.startOffset + charIndex;
  const absEnd = Math.min(segment.endOffset, absStart + length);

  const startPos = resolvePosition(segment.slices, absStart);
  const endPos = resolvePosition(segment.slices, absEnd);

  const range = segment.slices[0].node.ownerDocument.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}

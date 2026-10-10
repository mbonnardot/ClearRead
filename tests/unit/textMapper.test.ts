// tests/unit/textMapper.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createWordRange,
  extractSentenceSegments,
  findReadableBlock,
  shouldTriggerTts
} from '../../src/content/textMapper';

describe('content textMapper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  it('segments sentences across nested inline nodes without mutating the DOM', () => {
    document.body.innerHTML = `
      <p id="prose">First <strong>bold</strong> sentence. Second <a href="#x">linked</a> sentence!</p>
    `;
    const p = document.getElementById('prose')!;
    const originalHtml = p.innerHTML;

    const segments = extractSentenceSegments(p, 'en');
    expect(segments).toHaveLength(2);
    expect(segments[0].range.toString().trim()).toBe('First bold sentence.');
    expect(segments[1].range.toString().trim()).toBe('Second linked sentence!');

    const boldWordRange = createWordRange(segments[0], 6);
    expect(boldWordRange?.toString()).toBe('bold');
    expect(p.innerHTML).toBe(originalHtml);
  });

  it('enforces ttsMode click vs alt-click rules and skips links on plain click', () => {
    document.body.innerHTML = `<p id="p">Read <a id="lnk" href="/test">this link</a> carefully.</p>`;
    const p = document.getElementById('p')!;
    const lnk = document.getElementById('lnk')!;

    expect(shouldTriggerTts(new MouseEvent('click', { bubbles: true }), 'off')).toBeNull();

    const clickOnLink = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickOnLink, 'target', { value: lnk });
    expect(shouldTriggerTts(clickOnLink, 'click')).toBeNull();

    const altClickOnLink = new MouseEvent('click', { altKey: true, bubbles: true });
    Object.defineProperty(altClickOnLink, 'target', { value: lnk });
    expect(shouldTriggerTts(altClickOnLink, 'alt-click')).toBe(p);

    const clickOnProse = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickOnProse, 'target', { value: p });
    expect(shouldTriggerTts(clickOnProse, 'click')).toBe(p);
    expect(shouldTriggerTts(clickOnProse, 'alt-click')).toBeNull();
  });

  it('handles edge cases for non-readable targets, active text selection, empty/short blocks, and word bounds', () => {
    expect(findReadableBlock(null)).toBeNull();
    expect(findReadableBlock(document.createElement('div'))).toBeNull();

    document.body.innerHTML = `
      <p id="empty"></p>
      <p id="short">A</p>
      <p id="normal">Hello world.</p>
    `;
    expect(extractSentenceSegments(document.getElementById('empty')!)).toEqual([]);
    expect(extractSentenceSegments(document.getElementById('short')!)).toEqual([]);

    const normal = document.getElementById('normal')!;
    const selection = window.getSelection()!;
    const selRange = document.createRange();
    selRange.selectNodeContents(normal);
    selection.addRange(selRange);

    const clickWhileSelected = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickWhileSelected, 'target', { value: normal });
    expect(shouldTriggerTts(clickWhileSelected, 'click')).toBeNull();
    selection.removeAllRanges();

    const [segment] = extractSentenceSegments(normal);
    expect(createWordRange(segment, -1)).toBeNull();
    expect(createWordRange(segment, 999)).toBeNull();
    expect(createWordRange(segment, 5)).toBeNull(); // space character has no word tokens
    expect(createWordRange(segment, 6, 5)?.toString()).toBe('world');
  });
});

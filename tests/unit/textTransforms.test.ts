import { beforeEach, describe, expect, it } from 'vitest';
import { enrichElementText, syllabifyText, syllabifyWord } from '../../src/shared/textTransforms';

describe('shared textTransforms', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('syllabifies words with >= 6 alphabetic characters while preserving short words and punctuation', () => {
    expect(syllabifyWord('cat')).toBe('cat');
    expect(syllabifyWord('world')).toBe('world');
    expect(syllabifyWord('hello!')).toBe('hello!');

    const immersive = syllabifyWord('"immersive,"');
    expect(immersive.startsWith('"')).toBe(true);
    expect(immersive.endsWith(',"')).toBe(true);
    expect(immersive.includes('·')).toBe(true);
    expect(immersive.replace(/·/g, '')).toBe('"immersive,"');

    expect(syllabifyWord('dyslexia').includes('·')).toBe(true);
    expect(syllabifyWord('dyslexia').replace(/·/g, '')).toBe('dyslexia');

    expect(syllabifyWord('comprehension').split('·').length).toBeGreaterThanOrEqual(3);
    expect(syllabifyWord('comprehension').replace(/·/g, '')).toBe('comprehension');
  });

  it('syllabifies prose text while preserving spacing', () => {
    const out = syllabifyText('Clear immersive comprehension for readers.');
    expect(out.startsWith('Clear ')).toBe(true);
    expect(out.includes('·')).toBe(true);
    expect(out.replace(/·/g, '')).toBe('Clear immersive comprehension for readers.');
  });

  it('applies Bionic fixation bolding and Syllable Dots safely without innerHTML XSS and restores clean DOM', () => {
    document.body.innerHTML = `
      <article id="root">
        <p id="p1">Immersive reading comprehension</p>
        <p id="p2">Safe <code>inlineCode()</code> and <button type="button">ButtonText</button> intact &lt;img src=x onerror=alert(1)&gt;</p>
      </article>
    `;
    const root = document.getElementById('root');
    if (!root) throw new Error('missing root');
    const p1 = document.getElementById('p1');
    const p2 = document.getElementById('p2');
    if (!p1 || !p2) throw new Error('missing paragraphs');

    // Bionic only
    enrichElementText(root, { bionic: true, syllables: false });
    const strongs = p1.querySelectorAll('strong.cr-bionic');
    expect(strongs.length).toBe(3);
    expect(strongs[0].textContent).toBe('Immer');
    expect(p1.textContent).toBe('Immersive reading comprehension');

    // Code and button inside p2 must NOT be enriched, and literal <img ...> stays plain text
    expect(p2.querySelector('code strong.cr-bionic')).toBeNull();
    expect(p2.querySelector('button strong.cr-bionic')).toBeNull();
    expect(p2.querySelector('img')).toBeNull();

    // Bionic + Syllable Dots
    enrichElementText(root, { bionic: true, syllables: true });
    expect(p1.textContent?.includes('·')).toBe(true);
    expect(p1.querySelectorAll('strong.cr-bionic').length).toBe(3);

    // Syllable Dots only
    enrichElementText(root, { bionic: false, syllables: true });
    expect(p1.querySelectorAll('strong.cr-bionic').length).toBe(0);
    expect(p1.textContent?.includes('·')).toBe(true);

    // Restore original clean text nodes
    enrichElementText(root, { bionic: false, syllables: false });
    expect(p1.querySelector('[data-cr-enriched]')).toBeNull();
    expect(p1.textContent).toBe('Immersive reading comprehension');
  });
});

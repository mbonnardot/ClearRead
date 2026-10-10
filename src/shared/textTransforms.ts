const SEPARABLE_WORD_RE = /^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/;
const VOWEL_SPAN_RE = /[aeiouyAEIOUY]+/g;
const WORD_TOKEN_SPLIT_RE = /(\S+|\s+)/g;

const INSEPARABLE_ONSETS = new Set([
  'bl',
  'br',
  'ch',
  'cl',
  'cr',
  'dr',
  'fl',
  'fr',
  'gl',
  'gr',
  'ph',
  'pl',
  'pr',
  'sc',
  'sh',
  'sk',
  'sp',
  'st',
  'sw',
  'th',
  'tr',
  'tw',
  'wh',
  'wr'
]);

const SKIPPED_ANCESTOR_SELECTOR =
  'script, style, pre, code, kbd, samp, button, input, select, textarea, svg';

export interface EnrichTextOptions {
  readonly bionic: boolean;
  readonly syllables: boolean;
}

export function syllabifyWord(word: string): string {
  const match = SEPARABLE_WORD_RE.exec(word);
  if (!match) return word;

  const prefix = match[1];
  const core = match[2];
  const suffix = match[3];

  if (core.length < 6) return word;

  const rawVowels = Array.from(core.matchAll(VOWEL_SPAN_RE)).map((m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length
  }));

  if (rawVowels.length < 2) return word;

  // Treat trailing silent 'e' as part of the last syllable
  const lastVowel = rawVowels[rawVowels.length - 1];
  const vowelSpans =
    rawVowels.length > 2 &&
    lastVowel.start === core.length - 1 &&
    core[lastVowel.start].toLowerCase() === 'e'
      ? rawVowels.slice(0, -1)
      : rawVowels;

  if (vowelSpans.length < 2) return word;

  const splitPoints: number[] = [];

  for (let i = 0; i < vowelSpans.length - 1; i += 1) {
    const v1End = vowelSpans[i].end;
    const v2Start = vowelSpans[i + 1].start;
    const cLen = v2Start - v1End;
    const cons = core.slice(v1End, v2Start).toLowerCase();

    let splitAt = v1End;
    if (cLen === 0) {
      splitAt = v2Start;
    } else if (cLen === 1) {
      splitAt = v1End;
    } else if (cLen === 2) {
      splitAt = INSEPARABLE_ONSETS.has(cons) ? v1End : v1End + 1;
    } else {
      splitAt = INSEPARABLE_ONSETS.has(cons.slice(-2)) ? v2Start - 2 : v1End + 1;
    }

    if (splitAt >= 2 && splitAt <= core.length - 2) {
      splitPoints.push(splitAt);
    }
  }

  if (splitPoints.length === 0) return word;

  const parts: string[] = [];
  let cursor = 0;
  for (const pt of splitPoints) {
    if (pt > cursor) {
      parts.push(core.slice(cursor, pt));
      cursor = pt;
    }
  }
  parts.push(core.slice(cursor));

  return `${prefix}${parts.join('·')}${suffix}`;
}

export function syllabifyText(text: string): string {
  const tokens = text.match(WORD_TOKEN_SPLIT_RE);
  if (!tokens) return text;
  return tokens.map((token) => (/^\s+$/.test(token) ? token : syllabifyWord(token))).join('');
}

function unwrapEnrichedNodes(root: ParentNode, doc: Document): void {
  const wrappers = root.querySelectorAll('span[data-cr-enriched="true"]');
  for (const wrapper of wrappers) {
    if (wrapper instanceof HTMLElement) {
      const orig = wrapper.dataset.crOrig ?? wrapper.textContent ?? '';
      wrapper.replaceWith(doc.createTextNode(orig));
    }
  }
}

function createEnrichedSpan(doc: Document, raw: string, options: EnrichTextOptions): HTMLSpanElement {
  const wrapper = doc.createElement('span');
  wrapper.dataset.crEnriched = 'true';
  wrapper.dataset.crOrig = raw;

  const prepared = options.syllables ? syllabifyText(raw) : raw;

  if (!options.bionic) {
    wrapper.appendChild(doc.createTextNode(prepared));
    return wrapper;
  }

  const tokens = prepared.match(WORD_TOKEN_SPLIT_RE) ?? [prepared];
  for (const token of tokens) {
    if (/^\s+$/.test(token) || !/[a-zA-Z]/.test(token)) {
      wrapper.appendChild(doc.createTextNode(token));
    } else {
      const boldCount = Math.max(1, Math.ceil(token.length * 0.45));
      const strong = doc.createElement('strong');
      strong.className = 'cr-bionic';
      strong.appendChild(doc.createTextNode(token.slice(0, boldCount)));
      wrapper.appendChild(strong);
      if (boldCount < token.length) {
        wrapper.appendChild(doc.createTextNode(token.slice(boldCount)));
      }
    }
  }

  return wrapper;
}

export function enrichElementText(root: ParentNode, options: EnrichTextOptions): void {
  const doc = root instanceof Document ? root : (root.ownerDocument ?? document);
  unwrapEnrichedNodes(root, doc);

  if (!options.bionic && !options.syllables) {
    return;
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (
      current instanceof Text &&
      current.data.trim().length > 0 &&
      !current.parentElement?.closest(SKIPPED_ANCESTOR_SELECTOR)
    ) {
      textNodes.push(current);
    }
    current = walker.nextNode();
  }

  for (const node of textNodes) {
    node.replaceWith(createEnrichedSpan(doc, node.data, options));
  }
}

import { createOverlayController } from '../content/overlayHost';
import { createTtsController } from '../content/ttsEngine';
import { getSettings, subscribeSettings, updateSettings } from '../shared/storage';
import { enrichElementText } from '../shared/textTransforms';
import type { ClearReadSettings, FontFamily, RulerStyle, TintColor, TtsRate } from '../shared/types';

export interface PdfTextItem {
  readonly str: string;
  readonly transform: readonly number[];
}

export interface PdfPageLike {
  getTextContent(): Promise<{ items: ReadonlyArray<{ str?: string; transform?: readonly number[] }> }>;
  getViewport(params: { scale: number }): { width: number; height: number; scale: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number; scale: number };
  }): { promise: Promise<void> };
}

export interface PdfDocumentLike {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

export interface PdfViewerOptions {
  readonly doc?: Document;
  readonly initialUrl?: string | null;
  readonly loadDocument?: (source: { url?: string; data?: ArrayBuffer }) => Promise<PdfDocumentLike>;
}

export interface PdfViewerController {
  destroy(): void;
  loadPdfSource(source: { url?: string; data?: ArrayBuffer }): Promise<void>;
}

interface ExtractedPageData {
  readonly pageNumber: number;
  readonly items: readonly PdfTextItem[];
  readonly paragraphs: readonly string[];
}

export function reconstructParagraphsFromItems(items: readonly PdfTextItem[]): string[] {
  const paragraphs: string[] = [];
  let currentParts: string[] = [];
  let lastY: number | null = null;
  let lastFontHeight = 12;

  for (const item of items) {
    const trimmed = item.str.trim();
    if (!trimmed) continue;

    const y = item.transform[5] ?? 0;
    const fontHeight = Math.abs(item.transform[3] ?? 12) || 12;
    const threshold = Math.max(lastFontHeight, fontHeight) * 1.9;

    if (lastY !== null && Math.abs(lastY - y) > threshold && currentParts.length > 0) {
      paragraphs.push(currentParts.join(' '));
      currentParts = [trimmed];
    } else {
      currentParts.push(trimmed);
    }

    lastY = y;
    lastFontHeight = fontHeight;
  }

  if (currentParts.length > 0) {
    paragraphs.push(currentParts.join(' '));
  }
  return paragraphs;
}

async function defaultLoadPdfDocument(source: {
  url?: string;
  data?: ArrayBuffer;
}): Promise<PdfDocumentLike> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('pdf.worker.min.mjs')
      : './pdf.worker.min.mjs';
  const task = pdfjs.getDocument(source);
  return (await task.promise) as unknown as PdfDocumentLike;
}

function clearElementChildren(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function renderReflowPages(
  doc: Document,
  container: HTMLElement,
  pages: readonly ExtractedPageData[],
  settings: ClearReadSettings
): void {
  clearElementChildren(container);
  container.style.fontFamily = `'${settings.font}', sans-serif`;
  container.style.fontSize = `${((settings.fontScale / 100) * 1.125).toFixed(3)}rem`;
  container.style.lineHeight = settings.lineHeight;
  doc.body.style.setProperty('--cr-pdf-bg', settings.tintColor);
  doc.body.classList.toggle('cr-pdf-alternation', settings.paragraphAlternation);

  for (const page of pages) {
    const section = doc.createElement('section');
    section.className = 'pdf-reflow-page';
    section.dataset.page = String(page.pageNumber);

    for (const paraText of page.paragraphs) {
      const p = doc.createElement('p');
      p.textContent = paraText;
      if (settings.bionicReading || settings.syllableDots) {
        enrichElementText(p, {
          bionic: settings.bionicReading,
          syllables: settings.syllableDots
        });
      }
      section.appendChild(p);
    }
    container.appendChild(section);
  }
}

async function renderCanvasPages(
  doc: Document,
  container: HTMLElement,
  pdfDoc: PdfDocumentLike
): Promise<void> {
  clearElementChildren(container);
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.25 });
    const wrapper = doc.createElement('div');
    wrapper.className = 'pdf-canvas-page';

    const canvas = doc.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    const textLayer = doc.createElement('div');
    textLayer.className = 'pdf-text-layer';
    const rawContent = await page.getTextContent();
    const validItems: PdfTextItem[] = rawContent.items.filter(
      (it): it is PdfTextItem => typeof it.str === 'string' && Array.isArray(it.transform)
    );
    for (const para of reconstructParagraphsFromItems(validItems)) {
      const span = doc.createElement('p');
      span.textContent = para;
      textLayer.appendChild(span);
    }

    wrapper.appendChild(canvas);
    wrapper.appendChild(textLayer);
    container.appendChild(wrapper);
  }
}

function syncToolbarControls(doc: Document, settings: ClearReadSettings): void {
  const fontSelect = doc.getElementById('pdfFontSelect') as HTMLSelectElement | null;
  const scaleRange = doc.getElementById('pdfScaleRange') as HTMLInputElement | null;
  const rulerSelect = doc.getElementById('pdfRulerSelect') as HTMLSelectElement | null;
  const tintSelect = doc.getElementById('pdfTintSelect') as HTMLSelectElement | null;
  const bionicToggle = doc.getElementById('pdfBionicToggle') as HTMLInputElement | null;
  const syllablesToggle = doc.getElementById('pdfSyllablesToggle') as HTMLInputElement | null;
  const rateSelect = doc.getElementById('pdfRateSelect') as HTMLSelectElement | null;

  if (fontSelect) fontSelect.value = settings.font;
  if (scaleRange) scaleRange.value = String(settings.fontScale);
  if (rulerSelect) rulerSelect.value = settings.rulerStyle;
  if (tintSelect) tintSelect.value = settings.tintColor;
  if (bionicToggle) bionicToggle.checked = settings.bionicReading;
  if (syllablesToggle) syllablesToggle.checked = settings.syllableDots;
  if (rateSelect) rateSelect.value = String(settings.ttsRate);
}

export async function initPdfViewer(options: PdfViewerOptions = {}): Promise<PdfViewerController> {
  const doc = options.doc ?? document;
  const loadDocument = options.loadDocument ?? defaultLoadPdfDocument;
  let currentSettings = await getSettings();
  let viewMode: 'reflow' | 'canvas' = 'reflow';
  let activePdf: PdfDocumentLike | null = null;
  let extractedPages: ExtractedPageData[] = [];

  const overlay = createOverlayController({
    onTogglePause: () => tts.togglePause(),
    onStop: () => tts.stop()
  });
  const tts = createTtsController(overlay);

  const reflowContainer = doc.getElementById('pdfReflowContainer') as HTMLElement | null;
  const canvasContainer = doc.getElementById('pdfCanvasContainer') as HTMLElement | null;
  const dropzone = doc.getElementById('pdfDropzone') as HTMLElement | null;
  const statusEl = doc.getElementById('pdfStatus') as HTMLElement | null;
  const modeReflowBtn = doc.getElementById('modeReflowBtn') as HTMLButtonElement | null;
  const modeCanvasBtn = doc.getElementById('modeCanvasBtn') as HTMLButtonElement | null;

  const applyVisualState = (): void => {
    syncToolbarControls(doc, currentSettings);
    overlay.setRulerConfig(currentSettings.rulerEnabled, currentSettings.rulerStyle);
    tts.setRate(currentSettings.ttsRate);
    if (reflowContainer && extractedPages.length > 0) {
      renderReflowPages(doc, reflowContainer, extractedPages, currentSettings);
    }
  };

  const updateViewMode = async (nextMode: 'reflow' | 'canvas'): Promise<void> => {
    viewMode = nextMode;
    modeReflowBtn?.setAttribute('aria-pressed', nextMode === 'reflow' ? 'true' : 'false');
    modeCanvasBtn?.setAttribute('aria-pressed', nextMode === 'canvas' ? 'true' : 'false');
    if (reflowContainer) reflowContainer.hidden = nextMode !== 'reflow' || !activePdf;
    if (canvasContainer) {
      canvasContainer.hidden = nextMode !== 'canvas' || !activePdf;
      if (nextMode === 'canvas' && activePdf && canvasContainer.childElementCount === 0) {
        await renderCanvasPages(doc, canvasContainer, activePdf);
      }
    }
  };

  const loadPdfSource = async (source: { url?: string; data?: ArrayBuffer }): Promise<void> => {
    try {
      const pdf = await loadDocument(source);
      activePdf = pdf;
      const pages: ExtractedPageData[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items: PdfTextItem[] = textContent.items.filter(
          (it): it is PdfTextItem => typeof it.str === 'string' && Array.isArray(it.transform)
        );
        pages.push({ pageNumber: i, items, paragraphs: reconstructParagraphsFromItems(items) });
      }
      extractedPages = pages;
      if (dropzone) dropzone.hidden = true;
      if (canvasContainer) clearElementChildren(canvasContainer);
      applyVisualState();
      await updateViewMode(viewMode);
    } catch {
      if (statusEl) {
        statusEl.textContent = 'Could not load PDF directly. Please drop or select a local PDF file.';
      }
    }
  };

  bindToolbarEvents(
    doc,
    (patch) => {
      currentSettings = { ...currentSettings, ...patch };
      applyVisualState();
      void updateSettings(patch);
    },
    loadPdfSource,
    updateViewMode
  );

  const onWorkspaceClick = (e: MouseEvent): void => {
    const target = (e.target instanceof Element ? e.target : null)?.closest('p');
    if (target instanceof HTMLElement && currentSettings.ttsMode !== 'off') {
      tts.speakBlock(target);
    }
  };
  doc.addEventListener('click', onWorkspaceClick);

  const unsub = subscribeSettings((next: ClearReadSettings) => {
    currentSettings = next;
    applyVisualState();
  });

  applyVisualState();
  const initialUrl =
    options.initialUrl ?? new URLSearchParams(window.location.search).get('url');
  if (initialUrl) {
    await loadPdfSource({ url: initialUrl });
  }

  return {
    loadPdfSource,
    destroy: () => {
      unsub();
      doc.removeEventListener('click', onWorkspaceClick);
      tts.stop();
      overlay.destroy();
    }
  };
}

function bindToolbarEvents(
  doc: Document,
  onPatch: (patch: Partial<ClearReadSettings>) => void,
  onLoadPdf: (source: { url?: string; data?: ArrayBuffer }) => Promise<void>,
  onSwitchMode: (mode: 'reflow' | 'canvas') => Promise<void>
): void {
  const modeReflowBtn = doc.getElementById('modeReflowBtn');
  const modeCanvasBtn = doc.getElementById('modeCanvasBtn');
  const openLocalBtn = doc.getElementById('openLocalPdfBtn');
  const fileInput = doc.getElementById('pdfFileInput') as HTMLInputElement | null;
  const dropzone = doc.getElementById('pdfDropzone');

  modeReflowBtn?.addEventListener('click', () => {
    void onSwitchMode('reflow');
  });
  modeCanvasBtn?.addEventListener('click', () => {
    void onSwitchMode('canvas');
  });
  openLocalBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) {
      const data = await file.arrayBuffer();
      await onLoadPdf({ data });
    }
  });
  dropzone?.addEventListener('dragover', (e) => e.preventDefault());
  dropzone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    const dragEvent = e as DragEvent;
    const file = dragEvent.dataTransfer?.files?.[0];
    if (file) {
      const data = await file.arrayBuffer();
      await onLoadPdf({ data });
    }
  });

  doc.getElementById('pdfFontSelect')?.addEventListener('change', (e) => {
    onPatch({ font: (e.target as HTMLSelectElement).value as FontFamily });
  });
  doc.getElementById('pdfScaleRange')?.addEventListener('input', (e) => {
    onPatch({ fontScale: Number((e.target as HTMLInputElement).value) });
  });
  doc.getElementById('pdfRulerSelect')?.addEventListener('change', (e) => {
    onPatch({ rulerEnabled: true, rulerStyle: (e.target as HTMLSelectElement).value as RulerStyle });
  });
  doc.getElementById('pdfTintSelect')?.addEventListener('change', (e) => {
    onPatch({ tintColor: (e.target as HTMLSelectElement).value as TintColor });
  });
  doc.getElementById('pdfBionicToggle')?.addEventListener('change', (e) => {
    onPatch({ bionicReading: (e.target as HTMLInputElement).checked });
  });
  doc.getElementById('pdfSyllablesToggle')?.addEventListener('change', (e) => {
    onPatch({ syllableDots: (e.target as HTMLInputElement).checked });
  });
  doc.getElementById('pdfRateSelect')?.addEventListener('change', (e) => {
    onPatch({ ttsRate: Number((e.target as HTMLSelectElement).value) as TtsRate });
  });
}

if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage?.sync) {
  const params = new URLSearchParams(window.location.search);
  if (params.has('url')) {
    void initPdfViewer({ initialUrl: params.get('url') });
  }
}

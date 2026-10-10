import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initPdfViewer, reconstructParagraphsFromItems } from '../../src/pdf/index';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';

describe('Accessible PDF.js Viewer (paragraph reconstruction, reflow & canvas modes, drag-drop, live aids)', () => {
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = {
      ...DEFAULT_SETTINGS,
      ...PROFILES.heavy,
      bionicReading: true,
      syllableDots: true,
      paragraphAlternation: true,
      fontScale: 115,
      rulerEnabled: true,
      rulerStyle: 'medium',
      hasSeenOnboarding: true
    };

    vi.stubGlobal(
      'Highlight',
      class {
        readonly ranges: Range[];
        constructor(...ranges: Range[]) {
          this.ranges = ranges;
        }
      }
    );
    Object.defineProperty(globalThis, 'CSS', {
      value: { highlights: new Map() },
      configurable: true
    });

    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn()
    });

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id/${path}`
      },
      storage: {
        sync: {
          get: (_def: unknown, cb: (res: Record<string, unknown>) => void) => cb({ ...stored }),
          set: (patch: Record<string, unknown>, cb?: () => void) => {
            stored = { ...stored, ...patch };
            cb?.();
          }
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    });
  });

  it('reconstructs multi-line paragraphs and splits distinct vertical gaps accurately', () => {
    const items = [
      { str: 'Comprehension improves', transform: [12, 0, 0, 12, 72, 700] },
      { str: 'with generous spacing', transform: [12, 0, 0, 12, 210, 700] },
      { str: 'across academic PDF lines.', transform: [12, 0, 0, 12, 72, 682] },
      { str: 'Second paragraph starts after vertical gap.', transform: [12, 0, 0, 12, 72, 645] }
    ];

    const paragraphs = reconstructParagraphsFromItems(items);
    expect(paragraphs).toEqual([
      'Comprehension improves with generous spacing across academic PDF lines.',
      'Second paragraph starts after vertical gap.'
    ]);
  });

  it('loads PDF from URL query parameter, renders enriched Reflowed view, switches to Original Canvas view, and supports file upload', async () => {
    const html = readFileSync(resolve(process.cwd(), 'src/pdf/pdf.html'), 'utf8');
    document.documentElement.innerHTML = html;

    const fakePage = {
      getTextContent: vi.fn(async () => ({
        items: [
          { str: 'Understanding', transform: [14, 0, 0, 14, 72, 720] },
          { str: 'multisyllabic typography.', transform: [14, 0, 0, 14, 175, 720] }
        ]
      })),
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
        scale
      })),
      render: vi.fn(() => ({ promise: Promise.resolve() }))
    };

    const mockLoadPdf = vi.fn(async () => ({
      numPages: 1,
      getPage: async () => fakePage
    }));

    const controller = await initPdfViewer({
      doc: document,
      initialUrl: 'https://example.org/research.pdf',
      loadDocument: mockLoadPdf
    });

    expect(mockLoadPdf).toHaveBeenCalledTimes(1);
    const dropzone = document.getElementById('pdfDropzone') as HTMLElement;
    expect(dropzone.hidden).toBe(true);

    const reflowContainer = document.getElementById('pdfReflowContainer') as HTMLElement;
    expect(reflowContainer.hidden).toBe(false);
    expect(reflowContainer.querySelector('section.pdf-reflow-page')).not.toBeNull();
    expect(reflowContainer.querySelectorAll('strong.cr-bionic').length).toBeGreaterThan(0);
    expect(reflowContainer.textContent).toContain('·');

    // Switch to Original Canvas Layout mode
    const modeCanvasBtn = document.getElementById('modeCanvasBtn') as HTMLButtonElement;
    modeCanvasBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    const canvasContainer = document.getElementById('pdfCanvasContainer') as HTMLElement;
    expect(canvasContainer.hidden).toBe(false);
    expect(canvasContainer.querySelector('canvas.pdf-page-canvas')).not.toBeNull();
    expect(canvasContainer.querySelector('.pdf-text-layer')).not.toBeNull();

    // Update live toolbar controls and verify storage persistence
    const rulerSelect = document.getElementById('pdfRulerSelect') as HTMLSelectElement;
    rulerSelect.value = 'wide';
    rulerSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.rulerStyle).toBe('wide');

    // Upload local PDF file via file input
    const fileInput = document.getElementById('pdfFileInput') as HTMLInputElement;
    const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const file = new File([fakePdfBytes], 'local.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => fakePdfBytes.buffer
    });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true
    });
    fileInput.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockLoadPdf).toHaveBeenCalledTimes(2);

    controller.destroy();
  });
});

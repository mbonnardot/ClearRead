import type { RulerStyle } from '../shared/types';

export const OVERLAY_HOST_ID = 'clearread-overlay-host';

export interface OverlayCallbacks {
  readonly onTogglePause: () => void;
  readonly onStop: () => void;
}

export type TtsPillStatus = 'hidden' | 'speaking' | 'paused';

export interface OverlayController {
  setTintColor(color: string | null): void;
  setRulerConfig(enabled: boolean, style: RulerStyle): void;
  setRulerEnabled(enabled: boolean): void;
  updatePdfBanner(isPdf: boolean, sourceUrl?: string): void;
  setTtsStatus(status: TtsPillStatus): void;
  destroy(): void;
}

const RULER_BAND_HEIGHTS: Record<RulerStyle, number> = {
  bar: 36,
  narrow: 40,
  medium: 96,
  wide: 160
};

const SHADOW_STYLES = `
  :host {
    all: initial;
  }
  #clearread-tint-layer {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483645;
    mix-blend-mode: multiply;
    display: none;
  }
  #clearread-ruler {
    position: fixed;
    left: 0;
    width: 100vw;
    height: 36px;
    background-color: rgba(255, 255, 0, 0.18);
    border-top: 2px solid rgba(180, 150, 0, 0.35);
    border-bottom: 2px solid rgba(180, 150, 0, 0.35);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
    transform: translateY(-50%);
  }
  #clearread-mask-top {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    background: rgba(18, 18, 22, 0.36);
    border-bottom: 1.5px solid rgba(11, 87, 208, 0.55);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
  }
  #clearread-mask-bottom {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(18, 18, 22, 0.36);
    border-top: 1.5px solid rgba(11, 87, 208, 0.55);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
  }
  #clearread-pdf-banner {
    position: fixed;
    top: 16px;
    right: 20px;
    z-index: 2147483647;
    display: none;
  }
  .pdf-open-btn {
    background: #0b57d0;
    color: #ffffff;
    border: none;
    border-radius: 999px;
    padding: 10px 18px;
    font: 600 13px/1 system-ui, sans-serif;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
    cursor: pointer;
  }
  #clearread-tts-pill {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 9999px;
    background: #1F1F1F;
    color: #FFFFFF;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  }
  #clearread-tts-pill[hidden] {
    display: none !important;
  }
  .pill-btn {
    border: none;
    border-radius: 9999px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: #D3E3FD;
    color: #041E49;
  }
  .pill-btn-stop {
    background: #F9DEDC;
    color: #410E0B;
  }
`;

export function detectPdfPage(
  doc: Document = document,
  loc: Location = window.location
): boolean {
  return (
    loc.pathname.toLowerCase().endsWith('.pdf') ||
    doc.contentType === 'application/pdf' ||
    Boolean(doc.querySelector('embed[type="application/pdf"]'))
  );
}

export function createOverlayController(
  callbacks: OverlayCallbacks,
  doc: Document = document
): OverlayController {
  doc.getElementById(OVERLAY_HOST_ID)?.remove();

  const host = doc.createElement('div');
  host.id = OVERLAY_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = doc.createElement('style');
  styleEl.textContent = SHADOW_STYLES;

  const tintLayer = doc.createElement('div');
  tintLayer.id = 'clearread-tint-layer';
  tintLayer.style.display = 'none';

  const ruler = doc.createElement('div');
  ruler.id = 'clearread-ruler';
  ruler.style.display = 'none';

  const topMask = doc.createElement('div');
  topMask.id = 'clearread-mask-top';
  topMask.style.display = 'none';

  const bottomMask = doc.createElement('div');
  bottomMask.id = 'clearread-mask-bottom';
  bottomMask.style.display = 'none';

  const pdfBanner = doc.createElement('div');
  pdfBanner.id = 'clearread-pdf-banner';
  pdfBanner.style.display = 'none';

  const openPdfBtn = doc.createElement('button');
  openPdfBtn.id = 'clearread-open-pdf-btn';
  openPdfBtn.className = 'pdf-open-btn';
  openPdfBtn.type = 'button';
  openPdfBtn.textContent = '📖 Read PDF in ClearRead';
  pdfBanner.appendChild(openPdfBtn);

  const pill = doc.createElement('div');
  pill.id = 'clearread-tts-pill';
  pill.hidden = true;

  const statusSpan = doc.createElement('span');
  statusSpan.id = 'clearread-tts-status';
  statusSpan.textContent = 'Reading…';

  const pauseBtn = doc.createElement('button');
  pauseBtn.id = 'clearread-tts-pause';
  pauseBtn.className = 'pill-btn';
  pauseBtn.type = 'button';
  pauseBtn.textContent = 'Pause';
  pauseBtn.setAttribute('aria-label', 'Pause reading');
  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onTogglePause();
  });

  const stopBtn = doc.createElement('button');
  stopBtn.id = 'clearread-tts-stop';
  stopBtn.className = 'pill-btn pill-btn-stop';
  stopBtn.type = 'button';
  stopBtn.textContent = 'Stop';
  stopBtn.setAttribute('aria-label', 'Stop reading');
  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onStop();
  });

  let pdfTargetUrl = window.location.href;
  openPdfBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const basePdfViewerUrl = chrome.runtime?.getURL
      ? chrome.runtime.getURL('pdf.html')
      : '/pdf.html';
    const viewerUrl = `${basePdfViewerUrl}?url=${encodeURIComponent(pdfTargetUrl)}`;
    window.location.assign(viewerUrl);
  });

  pill.append(statusSpan, pauseBtn, stopBtn);
  shadow.append(styleEl, tintLayer, ruler, topMask, bottomMask, pdfBanner, pill);
  doc.documentElement.appendChild(host);

  let rulerActive = false;
  let currentStyle: RulerStyle = 'medium';
  let currentY = Math.round(window.innerHeight * 0.4);

  function renderRulerPosition(): void {
    if (!rulerActive) {
      ruler.style.display = 'none';
      topMask.style.display = 'none';
      bottomMask.style.display = 'none';
      return;
    }

    if (currentStyle === 'bar') {
      topMask.style.display = 'none';
      bottomMask.style.display = 'none';
      ruler.style.display = 'block';
      ruler.style.top = `${currentY}px`;
      return;
    }

    const bandHeight = RULER_BAND_HEIGHTS[currentStyle];
    const halfBand = bandHeight / 2;
    ruler.style.display = 'none';
    topMask.style.display = 'block';
    bottomMask.style.display = 'block';
    topMask.style.height = `${Math.max(0, currentY - halfBand)}px`;
    bottomMask.style.top = `${Math.max(0, currentY + halfBand)}px`;
  }

  const onMouseMove = (e: MouseEvent): void => {
    if (!rulerActive) return;
    currentY = e.clientY;
    window.requestAnimationFrame(() => {
      renderRulerPosition();
    });
  };

  return {
    setTintColor(color: string | null): void {
      if (!color || color === '#FFFFFF') {
        tintLayer.style.display = 'none';
        return;
      }
      tintLayer.style.backgroundColor = color;
      tintLayer.style.display = 'block';
    },

    setRulerConfig(enabled: boolean, style: RulerStyle): void {
      const wasActive = rulerActive;
      rulerActive = enabled;
      currentStyle = style;

      if (enabled && !wasActive) {
        window.addEventListener('mousemove', onMouseMove, { passive: true });
      } else if (!enabled && wasActive) {
        window.removeEventListener('mousemove', onMouseMove);
      }

      renderRulerPosition();
    },

    setRulerEnabled(enabled: boolean): void {
      this.setRulerConfig(enabled, currentStyle);
    },

    updatePdfBanner(isPdf: boolean, sourceUrl: string = window.location.href): void {
      pdfTargetUrl = sourceUrl;
      pdfBanner.style.display = isPdf ? 'block' : 'none';
    },

    setTtsStatus(status: TtsPillStatus): void {
      if (status === 'hidden') {
        pill.hidden = true;
        return;
      }
      pill.hidden = false;
      const isPaused = status === 'paused';
      statusSpan.textContent = isPaused ? 'Paused' : 'Reading…';
      pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      pauseBtn.setAttribute('aria-label', isPaused ? 'Resume reading' : 'Pause reading');
    },

    destroy(): void {
      rulerActive = false;
      window.removeEventListener('mousemove', onMouseMove);
      host.remove();
    }
  };
}

export const OVERLAY_HOST_ID = 'clearread-overlay-host';

export interface OverlayCallbacks {
  readonly onTogglePause: () => void;
  readonly onStop: () => void;
}

export type TtsPillStatus = 'hidden' | 'speaking' | 'paused';

export interface OverlayController {
  setRulerEnabled(enabled: boolean): void;
  setTtsStatus(status: TtsPillStatus): void;
  destroy(): void;
}

const SHADOW_STYLES = `
  :host {
    all: initial;
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

export function createOverlayController(
  callbacks: OverlayCallbacks,
  doc: Document = document
): OverlayController {
  doc.getElementById(OVERLAY_HOST_ID)?.remove();

  const host = doc.createElement('div');
  host.id = OVERLAY_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = SHADOW_STYLES;

  const ruler = doc.createElement('div');
  ruler.id = 'clearread-ruler';

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

  pill.append(statusSpan, pauseBtn, stopBtn);
  shadow.append(style, ruler, pill);
  doc.documentElement.appendChild(host);

  let rulerActive = false;

  const onMouseMove = (e: MouseEvent) => {
    if (!rulerActive) return;
    window.requestAnimationFrame(() => {
      if (!rulerActive) return;
      ruler.style.display = 'block';
      ruler.style.top = `${e.clientY}px`;
    });
  };

  return {
    setRulerEnabled(enabled: boolean) {
      if (enabled === rulerActive) return;
      rulerActive = enabled;
      if (enabled) {
        window.addEventListener('mousemove', onMouseMove, { passive: true });
      } else {
        window.removeEventListener('mousemove', onMouseMove);
        ruler.style.display = 'none';
      }
    },

    setTtsStatus(status: TtsPillStatus) {
      if (status === 'hidden') {
        pill.hidden = true;
        return;
      }
      pill.hidden = false;
      statusSpan.textContent = status === 'paused' ? 'Paused' : 'Reading…';
      pauseBtn.textContent = status === 'paused' ? 'Resume' : 'Pause';
      pauseBtn.setAttribute(
        'aria-label',
        status === 'paused' ? 'Resume reading' : 'Pause reading'
      );
    },

    destroy() {
      rulerActive = false;
      window.removeEventListener('mousemove', onMouseMove);
      host.remove();
    }
  };
}

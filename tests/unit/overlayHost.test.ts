import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERLAY_HOST_ID, createOverlayController } from '../../src/content/overlayHost';

describe('content overlayHost (Shadow DOM Tint Layer, Ruler & TTS Pill)', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  it('shows ruler immediately at 40% viewport height when enabled, tracks cursor Y, and hides when disabled', () => {
    const controller = createOverlayController({
      onTogglePause: vi.fn(),
      onStop: vi.fn()
    });

    controller.setRulerEnabled(true);
    controller.setRulerEnabled(true);

    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    const ruler = shadow?.getElementById('clearread-ruler') as HTMLElement;
    expect(ruler.style.display).toBe('block');
    expect(ruler.style.top).toBe('320px');

    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 240 }));
    expect(ruler.style.top).toBe('240px');

    controller.setRulerEnabled(false);
    expect(ruler.style.display).toBe('none');
    controller.destroy();
  });

  it('toggles Shadow DOM #clearread-tint-layer visibility and background color via setTintColor', () => {
    const controller = createOverlayController({
      onTogglePause: vi.fn(),
      onStop: vi.fn()
    });
    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot!;
    const tintLayer = shadow.getElementById('clearread-tint-layer') as HTMLElement;
    expect(tintLayer).not.toBeNull();
    expect(tintLayer.style.display).toBe('none');

    controller.setTintColor('#FBF0D9');
    expect(tintLayer.style.display).toBe('block');
    expect(tintLayer.style.backgroundColor).toBe('rgb(251, 240, 217)');

    controller.setTintColor('#FFFFFF');
    expect(tintLayer.style.display).toBe('none');

    controller.setTintColor('#EAEFE9');
    expect(tintLayer.style.display).toBe('block');

    controller.setTintColor(null);
    expect(tintLayer.style.display).toBe('none');
    controller.destroy();
  });

  it('renders M3 floating TTS pill states and invokes pause/stop callbacks', () => {
    const onTogglePause = vi.fn();
    const onStop = vi.fn();
    const controller = createOverlayController({ onTogglePause, onStop });
    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot!;

    const pill = shadow.getElementById('clearread-tts-pill') as HTMLElement;
    expect(pill.hidden).toBe(true);

    controller.setTtsStatus('speaking');
    expect(pill.hidden).toBe(false);
    expect(shadow.getElementById('clearread-tts-status')?.textContent).toBe('Reading…');

    (shadow.getElementById('clearread-tts-pause') as HTMLButtonElement).click();
    expect(onTogglePause).toHaveBeenCalledTimes(1);

    controller.setTtsStatus('paused');
    expect(shadow.getElementById('clearread-tts-status')?.textContent).toBe('Paused');

    (shadow.getElementById('clearread-tts-stop') as HTMLButtonElement).click();
    expect(onStop).toHaveBeenCalledTimes(1);

    controller.setTtsStatus('hidden');
    expect(pill.hidden).toBe(true);

    controller.destroy();
    expect(document.getElementById(OVERLAY_HOST_ID)).toBeNull();
  });
});

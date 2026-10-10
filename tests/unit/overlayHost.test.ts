import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OVERLAY_HOST_ID,
  createOverlayController,
  detectPdfPage
} from '../../src/content/overlayHost';

describe('content overlayHost (Shadow DOM Tint Layer, Focus Mask Curtains, PDF Banner & TTS Pill)', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  it('supports bar ruler and Focus Mask narrow/medium/wide curtains tracking cursor Y', () => {
    const controller = createOverlayController({
      onTogglePause: vi.fn(),
      onStop: vi.fn()
    });

    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    if (!shadow) throw new Error('missing shadowRoot');
    const ruler = shadow.getElementById('clearread-ruler') as HTMLElement;
    const topMask = shadow.getElementById('clearread-mask-top') as HTMLElement;
    const bottomMask = shadow.getElementById('clearread-mask-bottom') as HTMLElement;

    // Default bar mode
    controller.setRulerConfig(true, 'bar');
    expect(ruler.style.display).toBe('block');
    expect(topMask.style.display).toBe('none');
    expect(ruler.style.top).toBe('320px');

    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 200 }));
    expect(ruler.style.top).toBe('200px');

    // Focus Mask medium (96px clear band -> top 200 - 48 = 152px, bottom top 200 + 48 = 248px)
    controller.setRulerConfig(true, 'medium');
    expect(ruler.style.display).toBe('none');
    expect(topMask.style.display).toBe('block');
    expect(bottomMask.style.display).toBe('block');
    expect(topMask.style.height).toBe('152px');
    expect(bottomMask.style.top).toBe('248px');

    // Focus Mask narrow (40px -> 200 - 20 = 180px, 200 + 20 = 220px)
    controller.setRulerConfig(true, 'narrow');
    expect(topMask.style.height).toBe('180px');
    expect(bottomMask.style.top).toBe('220px');

    // Focus Mask wide (160px -> 200 - 80 = 120px, 200 + 80 = 280px)
    controller.setRulerConfig(true, 'wide');
    expect(topMask.style.height).toBe('120px');
    expect(bottomMask.style.top).toBe('280px');

    controller.setRulerEnabled(false);
    expect(ruler.style.display).toBe('none');
    expect(topMask.style.display).toBe('none');
    expect(bottomMask.style.display).toBe('none');
    controller.destroy();
  });

  it('detects PDF tabs and toggles the floating "📖 Read PDF in ClearRead" banner button', () => {
    const fakePdfLoc = { pathname: '/papers/research.PDF' } as Location;
    expect(detectPdfPage(document, fakePdfLoc)).toBe(true);

    const htmlLoc = { pathname: '/articles/overview.html' } as Location;
    expect(detectPdfPage(document, htmlLoc)).toBe(false);

    document.body.innerHTML = '<embed type="application/pdf" src="/file">';
    expect(detectPdfPage(document, htmlLoc)).toBe(true);

    const controller = createOverlayController({
      onTogglePause: vi.fn(),
      onStop: vi.fn()
    });
    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    if (!shadow) throw new Error('missing shadowRoot');
    const banner = shadow.getElementById('clearread-pdf-banner') as HTMLElement;
    const btn = shadow.getElementById('clearread-open-pdf-btn') as HTMLButtonElement;

    expect(banner.style.display).toBe('none');
    controller.updatePdfBanner(true, 'https://arxiv.example/paper.pdf');
    expect(banner.style.display).toBe('block');
    expect(btn.textContent).toContain('Read PDF in ClearRead');

    controller.updatePdfBanner(false);
    expect(banner.style.display).toBe('none');
    controller.destroy();
  });

  it('toggles Shadow DOM #clearread-tint-layer and floating TTS pill callbacks', () => {
    const onTogglePause = vi.fn();
    const onStop = vi.fn();
    const controller = createOverlayController({ onTogglePause, onStop });
    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    if (!shadow) throw new Error('missing shadowRoot');

    const tintLayer = shadow.getElementById('clearread-tint-layer') as HTMLElement;
    controller.setTintColor('#FBF0D9');
    expect(tintLayer.style.display).toBe('block');
    expect(tintLayer.style.backgroundColor).toBe('rgb(251, 240, 217)');

    controller.setTintColor('#FFFFFF');
    expect(tintLayer.style.display).toBe('none');

    const pill = shadow.getElementById('clearread-tts-pill') as HTMLElement;
    controller.setTtsStatus('speaking');
    expect(pill.hidden).toBe(false);

    (shadow.getElementById('clearread-tts-pause') as HTMLButtonElement).click();
    expect(onTogglePause).toHaveBeenCalledTimes(1);

    (shadow.getElementById('clearread-tts-stop') as HTMLButtonElement).click();
    expect(onStop).toHaveBeenCalledTimes(1);

    controller.destroy();
    expect(document.getElementById(OVERLAY_HOST_ID)).toBeNull();
  });
});

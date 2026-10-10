import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initOnboarding } from '../../src/onboarding/index';
import { initPopup } from '../../src/popup/index';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';

describe('Material Design 3 Onboarding & Popup UI controllers', () => {
  let stored: Record<string, unknown>;
  let createTab: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stored = { ...DEFAULT_SETTINGS };
    createTab = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: (_def: unknown, cb: (res: Record<string, unknown>) => void) => cb({ ...stored }),
          set: (patch: Record<string, unknown>, cb?: () => void) => {
            stored = { ...stored, ...patch };
            cb?.();
          }
        }
      },
      tabs: { create: createTab }
    });
  });

  it('switches onboarding profile preview and persists chosen preset on save', () => {
    const html = readFileSync(resolve(process.cwd(), 'onboarding.html'), 'utf8');
    document.documentElement.innerHTML = html;
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    initOnboarding(document);

    const previewBox = document.getElementById('previewBox') as HTMLElement;
    expect(previewBox.style.fontFamily).toContain('Lexend');
    expect(previewBox.style.lineHeight).toBe('1.65');

    const heavyCard = document.querySelector('[data-profile="heavy"]') as HTMLElement;
    heavyCard.click();

    expect(heavyCard.classList.contains('selected')).toBe(true);
    expect(previewBox.style.fontFamily).toContain('OpenDyslexic');
    expect(previewBox.style.lineHeight).toBe('2');

    const saveStatus = document.getElementById('saveStatus') as HTMLElement;
    (document.getElementById('saveBtn') as HTMLButtonElement).click();
    expect(stored.font).toBe(PROFILES.heavy.font);
    expect(stored.ttsMode).toBe('click');
    expect(stored.hasSeenOnboarding).toBe(true);
    expect(saveStatus.textContent).toBe('Profile applied!');
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('hydrates popup controls from storage and updates settings immutably on input', async () => {
    stored = { ...PROFILES.moderate, hasSeenOnboarding: true };
    const html = readFileSync(resolve(process.cwd(), 'popup.html'), 'utf8');
    document.documentElement.innerHTML = html;

    await initPopup(document);

    const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement;
    expect(enabledCheckbox.checked).toBe(true);
    enabledCheckbox.checked = false;
    enabledCheckbox.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.enabled).toBe(false);

    const fontSelect = document.getElementById('fontSelect') as HTMLSelectElement;
    expect(fontSelect.value).toBe('Atkinson Hyperlegible');

    fontSelect.value = 'Lexend';
    fontSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.font).toBe('Lexend');

    const rulerToggle = document.getElementById('rulerToggle') as HTMLInputElement;
    expect(rulerToggle.checked).toBe(true);
    rulerToggle.checked = false;
    rulerToggle.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.rulerEnabled).toBe(false);

    const lineHeight = document.getElementById('lineHeight') as HTMLInputElement;
    expect(lineHeight.value).toBe('1.8');
    lineHeight.value = '2.1';
    lineHeight.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.lineHeight).toBe('2.1');

    const tintSelect = document.getElementById('tintSelect') as HTMLSelectElement;
    expect(tintSelect.value).toBe('#FBF0D9');
    tintSelect.value = '#EAEFE9';
    tintSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.tintColor).toBe('#EAEFE9');

    const ttsSelect = document.getElementById('ttsSelect') as HTMLSelectElement;
    ttsSelect.value = 'click';
    ttsSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.ttsMode).toBe('click');

    (document.getElementById('resetProfilesLink') as HTMLAnchorElement).click();
    expect(createTab).toHaveBeenCalledWith({ url: 'onboarding.html' });
  });

  it('safely returns early when required DOM elements are missing', async () => {
    document.documentElement.innerHTML = '<body></body>';
    expect(() => initOnboarding(document)).not.toThrow();
    await expect(initPopup(document)).resolves.toBeUndefined();
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initBackground } from '../../src/background/index';
import { initOnboarding } from '../../src/onboarding/index';
import { initPopup } from '../../src/popup/index';
import { DEFAULT_SETTINGS, PROFILES } from '../../src/shared/profiles';

describe('Material Design 3 Background, Onboarding & Popup UI controllers', () => {
  let stored: Record<string, unknown>;
  let createTab: ReturnType<typeof vi.fn>;
  let queryTabs: ReturnType<typeof vi.fn>;
  let executeScript: ReturnType<typeof vi.fn>;
  let installedListener: ((details: { reason: string }) => void) | undefined;

  beforeEach(() => {
    stored = { ...DEFAULT_SETTINGS };
    createTab = vi.fn();
    queryTabs = vi.fn(async () => [
      { id: 1, url: 'https://example.com/article' },
      { id: 2, url: 'chrome://extensions' },
      { id: 3, url: 'http://localhost:3000/page' },
      { url: 'https://missing-id.example.com' }
    ]);
    executeScript = vi.fn(({ target }: { target: { tabId: number } }) =>
      target.tabId === 3 ? Promise.reject(new Error('Tab restricted')) : Promise.resolve([])
    );
    installedListener = undefined;

    vi.stubGlobal('chrome', {
      runtime: {
        onInstalled: {
          addListener: (cb: (details: { reason: string }) => void) => {
            installedListener = cb;
          }
        }
      },
      storage: {
        sync: {
          get: (_def: unknown, cb: (res: Record<string, unknown>) => void) => cb({ ...stored }),
          set: (patch: Record<string, unknown>, cb?: () => void) => {
            stored = { ...stored, ...patch };
            cb?.();
          }
        }
      },
      tabs: {
        create: createTab,
        query: queryTabs
      },
      scripting: {
        executeScript
      }
    });
  });

  it('injects content.js into open HTTP/HTTPS tabs on extension install and update', async () => {
    initBackground();
    expect(installedListener).toBeDefined();

    installedListener?.({ reason: 'install' });
    await new Promise((r) => setTimeout(r, 0));
    expect(createTab).toHaveBeenCalledWith({ url: 'onboarding.html' });
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['content.js'] });
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 3 }, files: ['content.js'] });

    createTab.mockClear();
    executeScript.mockClear();

    installedListener?.({ reason: 'update' });
    await new Promise((r) => setTimeout(r, 0));
    expect(createTab).not.toHaveBeenCalled();
    expect(executeScript).toHaveBeenCalledTimes(2);
  });

  it('switches onboarding profile preview, injects content script into open tabs, and persists preset on save', async () => {
    const html = readFileSync(resolve(process.cwd(), 'src/onboarding/onboarding.html'), 'utf8');
    document.documentElement.innerHTML = html;
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    initOnboarding(document);

    const previewBox = document.getElementById('previewBox') as HTMLElement;
    expect(previewBox.style.fontFamily).toContain('Lexend');
    expect(previewBox.style.lineHeight).toBe('1.65');

    const mildCard = document.querySelector('[data-profile="mild"]') as HTMLElement;
    const moderateCard = document.querySelector('[data-profile="moderate"]') as HTMLElement;
    const heavyCard = document.querySelector('[data-profile="heavy"]') as HTMLElement;

    expect(document.querySelector('.cards-grid')?.getAttribute('role')).toBe('radiogroup');
    expect(mildCard.getAttribute('aria-checked')).toBe('true');
    expect(moderateCard.getAttribute('aria-checked')).toBe('false');

    moderateCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(moderateCard.classList.contains('selected')).toBe(true);
    expect(moderateCard.getAttribute('aria-checked')).toBe('true');
    expect(mildCard.getAttribute('aria-checked')).toBe('false');
    expect(previewBox.style.fontFamily).toContain('Atkinson Hyperlegible');

    heavyCard.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(heavyCard.classList.contains('selected')).toBe(true);
    expect(heavyCard.getAttribute('aria-checked')).toBe('true');
    expect(previewBox.style.fontFamily).toContain('OpenDyslexic');
    expect(previewBox.style.lineHeight).toBe('2');

    mildCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(heavyCard.getAttribute('aria-checked')).toBe('true');

    const saveStatus = document.getElementById('saveStatus') as HTMLElement;
    (document.getElementById('saveBtn') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));

    expect(stored.enabled).toBe(true);
    expect(stored.font).toBe(PROFILES.heavy.font);
    expect(stored.ttsMode).toBe('click');
    expect(stored.hasSeenOnboarding).toBe(true);
    expect(saveStatus.textContent).toBe('Profile applied!');
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('hydrates popup controls, injects open tabs, switches profiles, and auto-enables on control edits', async () => {
    stored = { ...PROFILES.moderate, hasSeenOnboarding: true };
    const html = readFileSync(resolve(process.cwd(), 'src/popup/popup.html'), 'utf8');
    document.documentElement.innerHTML = html;

    await initPopup(document);
    expect(executeScript).toHaveBeenCalledTimes(2);

    const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement;
    const profileSelect = document.getElementById('profileSelect') as HTMLSelectElement;
    const fontSelect = document.getElementById('fontSelect') as HTMLSelectElement;
    const rulerToggle = document.getElementById('rulerToggle') as HTMLInputElement;
    const lineHeight = document.getElementById('lineHeight') as HTMLInputElement;
    const tintSelect = document.getElementById('tintSelect') as HTMLSelectElement;
    const ttsSelect = document.getElementById('ttsSelect') as HTMLSelectElement;

    expect(profileSelect.value).toBe('moderate');
    expect(enabledCheckbox.checked).toBe(true);

    // Explicitly turn off ClearRead
    enabledCheckbox.checked = false;
    enabledCheckbox.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.enabled).toBe(false);

    // Changing typeface auto-enables ClearRead
    fontSelect.value = 'Lexend';
    fontSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(enabledCheckbox.checked).toBe(true);
    expect(stored.enabled).toBe(true);
    expect(stored.font).toBe('Lexend');

    // Disable again, then changing ruler auto-enables
    enabledCheckbox.checked = false;
    enabledCheckbox.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    rulerToggle.checked = false;
    rulerToggle.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(enabledCheckbox.checked).toBe(true);
    expect(stored.enabled).toBe(true);
    expect(stored.rulerEnabled).toBe(false);

    // Disable again, then changing line spacing auto-enables
    enabledCheckbox.checked = false;
    enabledCheckbox.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    lineHeight.value = '2.1';
    lineHeight.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    expect(enabledCheckbox.checked).toBe(true);
    expect(stored.enabled).toBe(true);
    expect(stored.lineHeight).toBe('2.1');

    // Disable again, then changing tint auto-enables
    enabledCheckbox.checked = false;
    enabledCheckbox.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    tintSelect.value = '#EAEFE9';
    tintSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(enabledCheckbox.checked).toBe(true);
    expect(stored.enabled).toBe(true);
    expect(stored.tintColor).toBe('#EAEFE9');

    // Disable again, then changing TTS auto-enables
    enabledCheckbox.checked = false;
    enabledCheckbox.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    ttsSelect.value = 'click';
    ttsSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(enabledCheckbox.checked).toBe(true);
    expect(stored.enabled).toBe(true);
    expect(stored.ttsMode).toBe('click');

    // Switching profile preset updates all inputs and saves enabled preset
    enabledCheckbox.checked = false;
    enabledCheckbox.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    profileSelect.value = 'heavy';
    profileSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(enabledCheckbox.checked).toBe(true);
    expect(fontSelect.value).toBe('OpenDyslexic');
    expect(rulerToggle.checked).toBe(true);
    expect(lineHeight.value).toBe('2.0');
    expect(tintSelect.value).toBe('#FFF7E6');
    expect(ttsSelect.value).toBe('click');
    expect(stored.profile).toBe('heavy');
    expect(stored.enabled).toBe(true);

    (document.getElementById('resetProfilesLink') as HTMLAnchorElement).click();
    expect(createTab).toHaveBeenCalledWith({ url: 'onboarding.html' });
  });

  it('safely returns early when required DOM elements are missing', async () => {
    document.documentElement.innerHTML = '<body></body>';
    expect(() => initOnboarding(document)).not.toThrow();
    await expect(initPopup(document)).resolves.toBeUndefined();
  });
});

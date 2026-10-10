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
  let sendMessage: ReturnType<typeof vi.fn>;
  let executeScript: ReturnType<typeof vi.fn>;
  let installedListener: ((details: { reason: string }) => void) | undefined;
  let activeTabUrl: string;

  beforeEach(() => {
    stored = { ...DEFAULT_SETTINGS };
    activeTabUrl = 'https://example.com/article';
    createTab = vi.fn();
    sendMessage = vi.fn();
    queryTabs = vi.fn(async (queryInfo?: { active?: boolean }) => {
      if (queryInfo?.active) {
        return [{ id: 1, url: activeTabUrl }];
      }
      return [
        { id: 1, url: activeTabUrl },
        { id: 2, url: 'chrome://extensions' },
        { id: 3, url: 'http://localhost:3000/page' },
        { url: 'https://missing-id.example.com' }
      ];
    });
    executeScript = vi.fn(({ target }: { target: { tabId: number } }) =>
      target.tabId === 3 ? Promise.reject(new Error('Tab restricted')) : Promise.resolve([])
    );
    installedListener = undefined;

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id/${path}`,
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
        query: queryTabs,
        sendMessage
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

  it('uses native GAR <button> cards in onboarding, previews profiles, injects open tabs, and saves preset', async () => {
    const html = readFileSync(resolve(process.cwd(), 'src/onboarding/onboarding.html'), 'utf8');
    document.documentElement.innerHTML = html;
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    initOnboarding(document);

    const previewBox = document.getElementById('previewBox') as HTMLElement;
    expect(previewBox.style.fontFamily).toContain('Lexend');
    expect(previewBox.style.lineHeight).toBe('1.65');

    const mildCard = document.querySelector('[data-profile="mild"]') as HTMLButtonElement;
    const moderateCard = document.querySelector('[data-profile="moderate"]') as HTMLButtonElement;
    const heavyCard = document.querySelector('[data-profile="heavy"]') as HTMLButtonElement;

    expect(mildCard.tagName).toBe('BUTTON');
    expect(mildCard.getAttribute('aria-pressed')).toBe('true');
    expect(moderateCard.getAttribute('aria-pressed')).toBe('false');

    moderateCard.click();
    expect(moderateCard.classList.contains('selected')).toBe(true);
    expect(moderateCard.getAttribute('aria-pressed')).toBe('true');
    expect(mildCard.getAttribute('aria-pressed')).toBe('false');
    expect(previewBox.style.fontFamily).toContain('Atkinson Hyperlegible');

    heavyCard.click();
    expect(heavyCard.classList.contains('selected')).toBe(true);
    expect(heavyCard.getAttribute('aria-pressed')).toBe('true');
    expect(previewBox.style.fontFamily).toContain('OpenDyslexic');
    expect(previewBox.style.lineHeight).toBe('2');

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

  it('hydrates upgraded v2 popup controls, triggers Reader View & PDF viewer, manages site exclusions, and auto-enables on edits', async () => {
    stored = {
      ...DEFAULT_SETTINGS,
      ...PROFILES.moderate,
      hasSeenOnboarding: true
    };
    activeTabUrl = 'https://example.com/paper.pdf';
    const html = readFileSync(resolve(process.cwd(), 'src/popup/popup.html'), 'utf8');
    document.documentElement.innerHTML = html;

    await initPopup(document);

    const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement;
    const siteToggle = document.getElementById('siteToggle') as HTMLInputElement;
    const profileSelect = document.getElementById('profileSelect') as HTMLSelectElement;
    const fontSelect = document.getElementById('fontSelect') as HTMLSelectElement;
    const fontScale = document.getElementById('fontScale') as HTMLInputElement;
    const rulerStyleSelect = document.getElementById('rulerStyleSelect') as HTMLSelectElement;
    const lineHeight = document.getElementById('lineHeight') as HTMLInputElement;
    const tintSelect = document.getElementById('tintSelect') as HTMLSelectElement;
    const bionicToggle = document.getElementById('bionicToggle') as HTMLInputElement;
    const syllableToggle = document.getElementById('syllableToggle') as HTMLInputElement;
    const alternationToggle = document.getElementById('alternationToggle') as HTMLInputElement;
    const ttsSelect = document.getElementById('ttsSelect') as HTMLSelectElement;
    const ttsRateSelect = document.getElementById('ttsRateSelect') as HTMLSelectElement;
    const readerViewBtn = document.getElementById('readerViewBtn') as HTMLButtonElement;
    const openPdfBtn = document.getElementById('openPdfBtn') as HTMLButtonElement;

    expect(profileSelect.value).toBe('moderate');
    expect(enabledCheckbox.checked).toBe(true);
    expect(siteToggle.checked).toBe(true);

    // Quick Action: Reader View sends message to active tab
    readerViewBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(sendMessage).toHaveBeenCalledWith(1, { type: 'CLEARREAD_TOGGLE_READER' });

    // Quick Action: PDF Reader opens pdf.html?url=... when active tab is a PDF
    openPdfBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://test-id/pdf.html?url=https%3A%2F%2Fexample.com%2Fpaper.pdf'
    });

    // Site exclusion toggle updates excludedDomains
    siteToggle.checked = false;
    siteToggle.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.excludedDomains).toEqual(['example.com']);

    // Font scale, Focus Mask mode, Reading Aids, and Speech Rate updates persist cleanly
    fontScale.value = '120';
    fontScale.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.fontScale).toBe(120);

    rulerStyleSelect.value = 'wide';
    rulerStyleSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.rulerEnabled).toBe(true);
    expect(stored.rulerStyle).toBe('wide');

    rulerStyleSelect.value = 'off';
    rulerStyleSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.rulerEnabled).toBe(false);

    bionicToggle.checked = true;
    bionicToggle.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.bionicReading).toBe(true);

    syllableToggle.checked = true;
    syllableToggle.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.syllableDots).toBe(true);

    alternationToggle.checked = true;
    alternationToggle.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.paragraphAlternation).toBe(true);

    ttsRateSelect.value = '1.25';
    ttsRateSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored.ttsRate).toBe(1.25);

    // Switching profile updates controls and saves preset
    profileSelect.value = 'heavy';
    profileSelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(fontSelect.value).toBe('OpenDyslexic');
    expect(lineHeight.value).toBe('2.0');
    expect(tintSelect.value).toBe('#FFF7E6');
    expect(ttsSelect.value).toBe('click');

    (document.getElementById('resetProfilesLink') as HTMLAnchorElement).click();
    expect(createTab).toHaveBeenCalledWith({ url: 'onboarding.html' });
  });

  it('safely returns early when required DOM elements are missing', async () => {
    document.documentElement.innerHTML = '<body></body>';
    expect(() => initOnboarding(document)).not.toThrow();
    await expect(initPopup(document)).resolves.toBeUndefined();
  });
});

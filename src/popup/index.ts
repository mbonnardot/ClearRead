import { PROFILES } from '../shared/profiles';
import { getSettings, isDomainExcluded, updateSettings } from '../shared/storage';
import { injectContentScriptIntoOpenTabs } from '../shared/tabInjector';
import type { FontFamily, ProfileKey, RulerStyle, TintColor, TtsMode, TtsRate } from '../shared/types';

function extractHostname(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export async function initPopup(doc: Document = document): Promise<void> {
  void injectContentScriptIntoOpenTabs();

  const enabledEl = doc.getElementById('enabled') as HTMLInputElement | null;
  const siteToggleEl = doc.getElementById('siteToggle') as HTMLInputElement | null;
  const profileEl = doc.getElementById('profileSelect') as HTMLSelectElement | null;
  const fontEl = doc.getElementById('fontSelect') as HTMLSelectElement | null;
  const fontScaleEl = doc.getElementById('fontScale') as HTMLInputElement | null;
  const fontScaleValEl = doc.getElementById('fontScaleVal') as HTMLElement | null;
  const lineHeightEl = doc.getElementById('lineHeight') as HTMLInputElement | null;
  const lineHeightValEl = doc.getElementById('lineHeightVal') as HTMLElement | null;
  const rulerStyleEl = doc.getElementById('rulerStyleSelect') as HTMLSelectElement | null;
  const tintEl = doc.getElementById('tintSelect') as HTMLSelectElement | null;
  const bionicEl = doc.getElementById('bionicToggle') as HTMLInputElement | null;
  const syllableEl = doc.getElementById('syllableToggle') as HTMLInputElement | null;
  const alternationEl = doc.getElementById('alternationToggle') as HTMLInputElement | null;
  const ttsEl = doc.getElementById('ttsSelect') as HTMLSelectElement | null;
  const ttsRateEl = doc.getElementById('ttsRateSelect') as HTMLSelectElement | null;
  const readerViewBtn = doc.getElementById('readerViewBtn') as HTMLButtonElement | null;
  const openPdfBtn = doc.getElementById('openPdfBtn') as HTMLButtonElement | null;
  const resetLink = doc.getElementById('resetProfilesLink') as HTMLAnchorElement | null;

  if (
    !enabledEl ||
    !fontEl ||
    !fontScaleEl ||
    !lineHeightEl ||
    !rulerStyleEl ||
    !tintEl ||
    !bionicEl ||
    !syllableEl ||
    !alternationEl ||
    !ttsEl ||
    !ttsRateEl ||
    !resetLink
  ) {
    return;
  }

  let current = await getSettings();
  const activeTabs = await chrome.tabs?.query({ active: true, currentWindow: true });
  const activeTab = activeTabs?.[0];
  const activeHost = extractHostname(activeTab?.url);

  const syncFormControls = (): void => {
    enabledEl.checked = current.enabled;
    if (siteToggleEl) {
      siteToggleEl.checked = !activeHost || !isDomainExcluded(activeHost, current.excludedDomains);
    }
    if (profileEl) {
      profileEl.value = current.profile;
    }
    fontEl.value = current.font;
    fontScaleEl.value = String(current.fontScale);
    if (fontScaleValEl) fontScaleValEl.textContent = `${current.fontScale}%`;
    lineHeightEl.value = current.lineHeight;
    if (lineHeightValEl) lineHeightValEl.textContent = current.lineHeight;
    rulerStyleEl.value = current.rulerEnabled ? current.rulerStyle : 'off';
    tintEl.value = current.tintColor;
    bionicEl.checked = current.bionicReading;
    syllableEl.checked = current.syllableDots;
    alternationEl.checked = current.paragraphAlternation;
    ttsEl.value = current.ttsMode;
    ttsRateEl.value = String(current.ttsRate);
  };

  syncFormControls();

  const applyPatch = async (patch: Parameters<typeof updateSettings>[0]): Promise<void> => {
    current = await updateSettings(patch);
    syncFormControls();
  };

  enabledEl.addEventListener('change', () => {
    void applyPatch({ enabled: enabledEl.checked });
  });

  siteToggleEl?.addEventListener('change', () => {
    if (!activeHost) return;
    const nextExcluded = siteToggleEl.checked
      ? current.excludedDomains.filter((d) => d !== activeHost)
      : [...new Set([...current.excludedDomains, activeHost])];
    void applyPatch({ excludedDomains: nextExcluded });
  });

  readerViewBtn?.addEventListener('click', () => {
    if (typeof activeTab?.id === 'number') {
      void chrome.scripting?.executeScript?.({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
      chrome.tabs.sendMessage(activeTab.id, { type: 'CLEARREAD_TOGGLE_READER' });
    }
  });

  openPdfBtn?.addEventListener('click', () => {
    const basePdfViewer = chrome.runtime.getURL('pdf.html');
    const tabUrl = activeTab?.url ?? '';
    const targetUrl = tabUrl.toLowerCase().endsWith('.pdf')
      ? `${basePdfViewer}?url=${encodeURIComponent(tabUrl)}`
      : basePdfViewer;
    chrome.tabs.create({ url: targetUrl });
  });

  profileEl?.addEventListener('change', () => {
    const selected = profileEl.value as ProfileKey;
    const preset = PROFILES[selected];
    if (!preset) return;
    void applyPatch({ ...preset, enabled: true });
  });

  fontEl.addEventListener('change', () => {
    void applyPatch({ font: fontEl.value as FontFamily, enabled: true });
  });

  fontScaleEl.addEventListener('input', () => {
    void applyPatch({ fontScale: Number(fontScaleEl.value), enabled: true });
  });

  lineHeightEl.addEventListener('input', () => {
    void applyPatch({ lineHeight: lineHeightEl.value, enabled: true });
  });

  rulerStyleEl.addEventListener('change', () => {
    const val = rulerStyleEl.value;
    if (val === 'off') {
      void applyPatch({ rulerEnabled: false, enabled: true });
    } else {
      void applyPatch({ rulerEnabled: true, rulerStyle: val as RulerStyle, enabled: true });
    }
  });

  tintEl.addEventListener('change', () => {
    void applyPatch({ tintColor: tintEl.value as TintColor, enabled: true });
  });

  bionicEl.addEventListener('change', () => {
    void applyPatch({ bionicReading: bionicEl.checked, enabled: true });
  });

  syllableEl.addEventListener('change', () => {
    void applyPatch({ syllableDots: syllableEl.checked, enabled: true });
  });

  alternationEl.addEventListener('change', () => {
    void applyPatch({ paragraphAlternation: alternationEl.checked, enabled: true });
  });

  ttsEl.addEventListener('change', () => {
    void applyPatch({ ttsMode: ttsEl.value as TtsMode, enabled: true });
  });

  ttsRateEl.addEventListener('change', () => {
    void applyPatch({ ttsRate: Number(ttsRateEl.value) as TtsRate, enabled: true });
  });

  resetLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'onboarding.html' });
  });
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void initPopup(document));
  } else {
    void initPopup(document);
  }
}

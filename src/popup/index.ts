import { getSettings, updateSettings } from '../shared/storage';
import type { FontFamily, TintColor, TtsMode } from '../shared/types';

export async function initPopup(doc: Document = document): Promise<void> {
  const enabledEl = doc.getElementById('enabled') as HTMLInputElement | null;
  const fontEl = doc.getElementById('fontSelect') as HTMLSelectElement | null;
  const rulerEl = doc.getElementById('rulerToggle') as HTMLInputElement | null;
  const lineHeightEl = doc.getElementById('lineHeight') as HTMLInputElement | null;
  const tintEl = doc.getElementById('tintSelect') as HTMLSelectElement | null;
  const ttsEl = doc.getElementById('ttsSelect') as HTMLSelectElement | null;
  const resetLink = doc.getElementById('resetProfilesLink') as HTMLAnchorElement | null;

  if (!enabledEl || !fontEl || !rulerEl || !lineHeightEl || !tintEl || !ttsEl || !resetLink) {
    return;
  }

  const current = await getSettings();
  enabledEl.checked = current.enabled;
  fontEl.value = current.font;
  rulerEl.checked = current.rulerEnabled;
  lineHeightEl.value = current.lineHeight;
  tintEl.value = current.tintColor;
  ttsEl.value = current.ttsMode;

  enabledEl.addEventListener('change', () => {
    void updateSettings({ enabled: enabledEl.checked });
  });
  fontEl.addEventListener('change', () => {
    void updateSettings({ font: fontEl.value as FontFamily });
  });
  rulerEl.addEventListener('change', () => {
    void updateSettings({ rulerEnabled: rulerEl.checked });
  });
  lineHeightEl.addEventListener('input', () => {
    void updateSettings({ lineHeight: lineHeightEl.value });
  });
  tintEl.addEventListener('change', () => {
    void updateSettings({ tintColor: tintEl.value as TintColor });
  });
  ttsEl.addEventListener('change', () => {
    void updateSettings({ ttsMode: ttsEl.value as TtsMode });
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

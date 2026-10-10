import { PROFILES } from '../shared/profiles';
import { getSettings, updateSettings } from '../shared/storage';
import { injectContentScriptIntoOpenTabs } from '../shared/tabInjector';
import type { FontFamily, ProfileKey, TintColor, TtsMode } from '../shared/types';

export async function initPopup(doc: Document = document): Promise<void> {
  void injectContentScriptIntoOpenTabs();

  const enabledEl = doc.getElementById('enabled') as HTMLInputElement | null;
  const profileEl = doc.getElementById('profileSelect') as HTMLSelectElement | null;
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
  if (profileEl) {
    profileEl.value = current.profile;
  }
  fontEl.value = current.font;
  rulerEl.checked = current.rulerEnabled;
  lineHeightEl.value = current.lineHeight;
  tintEl.value = current.tintColor;
  ttsEl.value = current.ttsMode;

  enabledEl.addEventListener('change', () => {
    void updateSettings({ enabled: enabledEl.checked });
  });
  if (profileEl) {
    profileEl.addEventListener('change', () => {
      const selected = profileEl.value as ProfileKey;
      const preset = PROFILES[selected];
      if (!preset) return;
      enabledEl.checked = true;
      fontEl.value = preset.font;
      rulerEl.checked = preset.rulerEnabled;
      lineHeightEl.value = preset.lineHeight;
      tintEl.value = preset.tintColor;
      ttsEl.value = preset.ttsMode;
      void updateSettings({ ...preset, enabled: true });
    });
  }
  fontEl.addEventListener('change', () => {
    enabledEl.checked = true;
    void updateSettings({ font: fontEl.value as FontFamily, enabled: true });
  });
  rulerEl.addEventListener('change', () => {
    enabledEl.checked = true;
    void updateSettings({ rulerEnabled: rulerEl.checked, enabled: true });
  });
  lineHeightEl.addEventListener('input', () => {
    enabledEl.checked = true;
    void updateSettings({ lineHeight: lineHeightEl.value, enabled: true });
  });
  tintEl.addEventListener('change', () => {
    enabledEl.checked = true;
    void updateSettings({ tintColor: tintEl.value as TintColor, enabled: true });
  });
  ttsEl.addEventListener('change', () => {
    enabledEl.checked = true;
    void updateSettings({ ttsMode: ttsEl.value as TtsMode, enabled: true });
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

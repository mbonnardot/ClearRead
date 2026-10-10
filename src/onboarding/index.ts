import { PROFILES } from '../shared/profiles';
import { injectContentScriptIntoOpenTabs } from '../shared/tabInjector';
import type { ProfileKey } from '../shared/types';

export function initOnboarding(doc: Document = document): void {
  const previewBox = doc.getElementById('previewBox') as HTMLElement | null;
  const saveBtn = doc.getElementById('saveBtn') as HTMLButtonElement | null;
  const saveStatus = doc.getElementById('saveStatus') as HTMLElement | null;
  const cards = doc.querySelectorAll<HTMLButtonElement>('.m3-card');

  if (!previewBox || !saveBtn || cards.length === 0) return;

  let currentProfile: ProfileKey = 'mild';

  const updatePreview = (profileKey: ProfileKey): void => {
    const config = PROFILES[profileKey];
    previewBox.style.fontFamily = `'${config.font}', sans-serif`;
    previewBox.style.lineHeight = config.lineHeight;
    previewBox.style.letterSpacing = config.letterSpacing;
    previewBox.style.wordSpacing = config.wordSpacing;
    previewBox.style.backgroundColor = config.tintColor;
    previewBox.style.border = config.rulerEnabled
      ? '2px dashed #0B57D0'
      : '1px solid var(--md-sys-color-outline-variant)';
  };

  updatePreview(currentProfile);

  const selectCard = (card: HTMLButtonElement): void => {
    cards.forEach((c) => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('selected');
    card.setAttribute('aria-pressed', 'true');
    const key = card.dataset.profile as ProfileKey | undefined;
    if (key && key in PROFILES) {
      currentProfile = key;
      updatePreview(currentProfile);
    }
  };

  cards.forEach((card) => {
    card.addEventListener('click', () => selectCard(card));
  });

  saveBtn.addEventListener('click', () => {
    const settingsToSave = {
      ...PROFILES[currentProfile],
      enabled: true,
      hasSeenOnboarding: true
    };
    chrome.storage.sync.set(settingsToSave, async () => {
      if (saveStatus) {
        saveStatus.textContent = 'Profile applied!';
      }
      await injectContentScriptIntoOpenTabs();
      window.close();
    });
  });
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initOnboarding(document));
  } else {
    initOnboarding(document);
  }
}

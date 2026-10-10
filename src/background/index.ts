export function initBackground(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({ url: 'onboarding.html' });
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  initBackground();
}

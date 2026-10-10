import { injectContentScriptIntoOpenTabs } from '../shared/tabInjector';

export function initBackground(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({ url: 'onboarding.html' });
    }
    if (details.reason === 'install' || details.reason === 'update') {
      void injectContentScriptIntoOpenTabs();
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  initBackground();
}

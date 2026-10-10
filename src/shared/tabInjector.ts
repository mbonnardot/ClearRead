export async function injectContentScriptIntoOpenTabs(): Promise<void> {
  if (!chrome?.tabs?.query || !chrome?.scripting?.executeScript) return;
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs
        .filter((tab) => tab.id != null && tab.url && /^https?:\/\//i.test(tab.url))
        .map((tab) =>
          chrome.scripting
            .executeScript({ target: { tabId: tab.id! }, files: ['content.js'] })
            .catch(() => {})
        )
    );
  } catch {
    // Ignore tabs API errors in non-extension contexts
  }
}

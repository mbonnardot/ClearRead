import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test.describe('ClearRead unpacked Chrome extension E2E', () => {
  let context: BrowserContext;
  let userDataDir: string;
  let extensionId: string;

  test.beforeAll(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'clearread-e2e-'));
    const pathToExtension = resolve(process.cwd(), 'dist');

    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    extensionId = serviceWorker.url().split('/')[2];
  });

  test.afterAll(async () => {
    await context?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  });

  test('applies Multi-Sensory profile from onboarding and adapts dark-mode article safely', async () => {
    const onboardingPage = await context.newPage();
    await onboardingPage.goto(`chrome-extension://${extensionId}/onboarding.html`);

    await onboardingPage.locator('[data-profile="heavy"]').click();
    await expect(onboardingPage.locator('#previewBox')).toHaveCSS(
      'background-color',
      'rgb(255, 247, 230)'
    );

    await onboardingPage.evaluate(() => {
      return new Promise<void>((res) => {
        chrome.storage.sync.set(
          {
            enabled: true,
            profile: 'heavy',
            font: 'OpenDyslexic',
            lineHeight: '2.0',
            letterSpacing: '0.08em',
            wordSpacing: '0.18em',
            tintColor: '#FFF7E6',
            rulerEnabled: true,
            ttsMode: 'click',
            hasSeenOnboarding: true
          },
          () => res()
        );
      });
    });

    const articlePage = await context.newPage();
    await articlePage.route('https://clearread.test/article', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <style>
              body { background: #111; color: #eee; }
              main { display: grid; grid-template-columns: 1fr 300px; width: 1100px; }
            </style>
          </head>
          <body>
            <main id="gridLayout">
              <article>
                <p id="p1">ClearRead keeps multi-column layouts intact while fixing crowding.</p>
              </article>
              <aside>Sidebar</aside>
            </main>
          </body>
          </html>
        `
      });
    });

    await articlePage.goto('https://clearread.test/article');
    await expect(articlePage.locator('#p1')).toHaveCSS('color', 'rgb(31, 31, 31)');
    const mainWidth = await articlePage.locator('#gridLayout').evaluate((el) => el.clientWidth);
    expect(mainWidth).toBe(1100);
  });
});

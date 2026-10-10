import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function buildMinimalValidPdfBuffer(lineText: string): Buffer {
  const escaped = lineText.replace(/([()\\])/g, '\\$1');
  const streamBody = `BT /F1 14 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamBody, 'utf8')} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

test.describe('ClearRead v2 unpacked Chrome extension E2E', () => {
  let context: BrowserContext;
  let userDataDir: string;
  let extensionId: string;

  test.beforeAll(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'clearread-e2e-'));
    const pathToExtension = resolve(process.cwd());

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

  test('preserves dark cards & grids in non-destructive Web Mode, opens enriched Reader View (Alt+R), and renders reflowed PDFs via PDF.js', async () => {
    await context.route('https://clearread.test/article', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <title>Deep Reading Architecture</title>
            <style>
              body { background: #111111; color: #eeeeee; }
              main { display: grid; grid-template-columns: 1fr 300px; width: 1100px; }
              .dark-card { background-color: rgb(28, 32, 38); color: rgb(238, 238, 238); padding: 16px; }
            </style>
          </head>
          <body>
            <main id="gridLayout">
              <article class="dark-card" id="darkCard">
                <h1 id="title">Deep Reading Architecture</h1>
                <p id="p1">Immersive comprehension improves dramatically when typography preserves multi-column layouts and contrast safety across complex dark surfaces.</p>
                <p id="p2">Return-sweep paragraph alternation prevents accidental line skipping across dense academic articles and technical specifications.</p>
              </article>
              <aside>Sidebar</aside>
            </main>
          </body>
          </html>
        `
      });
    });

    const samplePdfBuffer = buildMinimalValidPdfBuffer(
      'Immersive comprehension transforms accessible documents.'
    );
    await context.route('https://clearread.test/sample.pdf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: samplePdfBuffer
      });
    });

    const articlePage = await context.newPage();
    await articlePage.goto('https://clearread.test/article');

    const onboardingPage = await context.newPage();
    await onboardingPage.goto(`chrome-extension://${extensionId}/onboarding.html`);
    await onboardingPage.locator('[data-profile="heavy"]').click();
    await expect(onboardingPage.locator('#previewBox')).toHaveCSS(
      'background-color',
      'rgb(255, 247, 230)'
    );
    await onboardingPage.locator('#saveBtn').click();

    // 1. Non-Destructive In-Page Mode: preserves dark card background & light text + grid width + Shadow DOM Focus Mask & Tint
    await expect(articlePage.locator('#darkCard')).toHaveCSS('background-color', 'rgb(28, 32, 38)');
    await expect(articlePage.locator('#p1')).toHaveCSS('color', 'rgb(238, 238, 238)');
    const mainWidth = await articlePage.locator('#gridLayout').evaluate((el) => el.clientWidth);
    expect(mainWidth).toBe(1100);

    await expect
      .poll(async () => {
        return articlePage.evaluate(() => {
          const shadow = document.getElementById('clearread-overlay-host')?.shadowRoot;
          const ruler = shadow?.getElementById('clearread-ruler') as HTMLElement | null;
          const maskTop = shadow?.getElementById('clearread-mask-top') as HTMLElement | null;
          const maskBottom = shadow?.getElementById('clearread-mask-bottom') as HTMLElement | null;
          const tint = shadow?.getElementById('clearread-tint-layer') as HTMLElement | null;
          return {
            rulerDisplay: ruler?.style.display,
            maskTopDisplay: maskTop?.style.display,
            maskBottomDisplay: maskBottom?.style.display,
            tintDisplay: tint?.style.display,
            tintBg: tint?.style.backgroundColor
          };
        });
      })
      .toEqual({
        rulerDisplay: 'none',
        maskTopDisplay: 'block',
        maskBottomDisplay: 'block',
        tintDisplay: 'block',
        tintBg: 'rgb(255, 247, 230)'
      });

    // 2. Distraction-Free Reader View (Alt+R): opens sanitized Readability dialog with Bionic bolding + Syllable dots
    await articlePage.bringToFront();
    await articlePage.keyboard.press('Alt+r');

    await expect
      .poll(async () => {
        return articlePage.evaluate(() => {
          const shadow = document.getElementById('clearread-reader-host')?.shadowRoot;
          const dialog = shadow?.getElementById('clearread-reader-dialog') as HTMLDialogElement | null;
          const article = shadow?.getElementById('clearread-reader-article');
          return {
            open: Boolean(dialog?.open),
            bionicCount: article?.querySelectorAll('strong.cr-bionic').length ?? 0,
            hasSyllableDot: article?.textContent?.includes('·') ?? false
          };
        });
      })
      .toEqual({
        open: true,
        bionicCount: expect.any(Number),
        hasSyllableDot: true
      });

    await articlePage.keyboard.press('Escape');

    // 3. Offline PDF.js Accessible Reader Workspace: loads PDF in Reflowed Dyslexia Mode + switches to Canvas Mode
    const pdfPage = await context.newPage();
    await pdfPage.goto(
      `chrome-extension://${extensionId}/pdf.html?url=${encodeURIComponent('https://clearread.test/sample.pdf')}`
    );

    await expect(pdfPage.locator('#pdfReflowContainer')).toBeVisible();
    await expect(pdfPage.locator('#pdfReflowContainer strong.cr-bionic').first()).toBeVisible();
    await expect(pdfPage.locator('#pdfReflowContainer')).toContainText('·');

    await pdfPage.locator('#modeCanvasBtn').click();
    await expect(pdfPage.locator('#pdfCanvasContainer canvas.pdf-page-canvas')).toBeVisible();
  });
});

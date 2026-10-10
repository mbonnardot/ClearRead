import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(rootDir, 'dist');

const htmlMappings = [
  ['dist/src/popup/popup.html', 'dist/popup.html'],
  ['dist/src/onboarding/onboarding.html', 'dist/onboarding.html']
];

for (const [srcRel, destRel] of htmlMappings) {
  const srcPath = resolve(rootDir, srcRel);
  const destPath = resolve(rootDir, destRel);
  if (existsSync(srcPath)) {
    const rawHtml = readFileSync(srcPath, 'utf8');
    const normalizedHtml = rawHtml
      .replace(/(?:\.\.\/)+styles\//g, './styles/')
      .replace(/\/styles\//g, './styles/')
      .replace(/(?:\.\.\/)+assets\//g, './assets/')
      .replace(/\/assets\//g, './assets/');
    writeFileSync(destPath, normalizedHtml, 'utf8');
  }
}

rmSync(resolve(distDir, 'src'), { recursive: true, force: true });

const rootSyncItems = [
  'manifest.json',
  'icon128.png',
  'background.js',
  'content.js',
  'popup.html',
  'onboarding.html',
  'assets',
  'fonts',
  'styles'
];

for (const item of rootSyncItems) {
  const fromPath = resolve(distDir, item);
  const toPath = resolve(rootDir, item);
  rmSync(toPath, { recursive: true, force: true });
  if (existsSync(fromPath)) {
    cpSync(fromPath, toPath, { recursive: true });
  }
}

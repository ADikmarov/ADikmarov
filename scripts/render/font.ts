import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fontPath = join(dirname(fileURLToPath(import.meta.url)), 'fonts', 'JetBrainsMono-Regular.woff2');

export function fontFace(): string {
  if (!existsSync(fontPath)) return '';
  const b64 = readFileSync(fontPath).toString('base64');
  return `@font-face { font-family: 'JetBrains Mono'; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
}

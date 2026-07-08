import { palette } from './palette';
import { escapeXml } from './text';
import { fontFace } from './font';

export interface Span { text: string; color?: string; bold?: boolean }
export interface Line { spans: Span[]; class?: string }
export interface TerminalOptions {
  width?: number;
  showChrome?: boolean;
  extraStyles?: string;
  extraElements?: string;
}

export const CHAR_W = 8.4;
export const LINE_H = 22;
export const PAD_X = 24;
export const PAD_TOP = 20;
const CHROME_H = 30;

export function renderTerminal(lines: Line[], opts: TerminalOptions = {}): string {
  const width = opts.width ?? 820;
  const chromeH = opts.showChrome ? CHROME_H : 0;
  const height = PAD_TOP + chromeH + lines.length * LINE_H + PAD_TOP;

  const chrome = opts.showChrome
    ? `<circle cx="${PAD_X + 6}" cy="${PAD_TOP + 6}" r="6" fill="${palette.red}"/>
<circle cx="${PAD_X + 28}" cy="${PAD_TOP + 6}" r="6" fill="${palette.yellow}"/>
<circle cx="${PAD_X + 50}" cy="${PAD_TOP + 6}" r="6" fill="${palette.green}"/>`
    : '';

  const textLines = lines
    .map((line, i) => {
      const y = PAD_TOP + chromeH + (i + 1) * LINE_H - 6;
      const cls = line.class ? `mono ${line.class}` : 'mono';
      const tspans = line.spans
        .map(
          (s) =>
            `<tspan fill="${s.color ?? palette.text}"${s.bold ? ' font-weight="600"' : ''}>${escapeXml(s.text)}</tspan>`,
        )
        .join('');
      return `<text x="${PAD_X}" y="${y}" xml:space="preserve" class="${cls}">${tspans}</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<style>
${fontFace()}
.mono { font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 14px; }
${opts.extraStyles ?? ''}
</style>
<rect width="${width}" height="${height}" rx="12" fill="${palette.bg}"/>
${chrome}
${textLines}
${opts.extraElements ?? ''}
</svg>
`;
}

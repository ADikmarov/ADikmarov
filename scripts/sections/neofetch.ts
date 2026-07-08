import { config } from '../config';
import { palette } from '../render/palette';
import { pad } from '../render/text';
import { renderTerminal, type Line, type Span } from '../render/terminal';

const ART = [
  ' █████╗ ██████╗ ',
  '██╔══██╗██╔══██╗',
  '███████║██║  ██║',
  '██╔══██║██║  ██║',
  '██║  ██║██████╔╝',
  '╚═╝  ╚═╝╚═════╝ ',
];
const ART_W = 18;
const LABEL_W = 9;

export function uptimeYears(now: Date): number {
  return now.getFullYear() - config.careerStartYear;
}

export function renderNeofetch(now: Date): string {
  const fields: Array<[string, string, string?]> = [
    ['Role', config.role],
    ['Company', config.company],
    ['Stack', config.stack.join(', ')],
    ['AI', config.ai.join(' · '), palette.mauve],
    ['OS', config.os],
    ['Shell', config.shell],
    ['Editor', config.editor],
    ['Uptime', `${uptimeYears(now)} years in production`, palette.green],
  ];

  const right: Span[][] = [
    [{ text: `artem @ github.com/${config.username}`, color: palette.green, bold: true }],
    [{ text: '─'.repeat(30), color: palette.overlay }],
    ...fields.map(([label, value, color]): Span[] => [
      { text: pad(label, LABEL_W), color: palette.blue, bold: true },
      { text: value, color: color ?? palette.text },
    ]),
  ];

  const rows = Math.max(ART.length, right.length);
  const artPadTop = Math.floor((rows - ART.length) / 2);
  const lines: Line[] = [];
  for (let i = 0; i < rows; i++) {
    const art = ART[i - artPadTop] ?? '';
    lines.push({
      spans: [{ text: pad(art, ART_W), color: palette.mauve, bold: true }, ...(right[i] ?? [])],
    });
  }
  return renderTerminal(lines);
}

export async function buildNeofetch(): Promise<string> {
  return renderNeofetch(new Date());
}

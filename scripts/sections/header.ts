import { config } from '../config';
import { palette } from '../render/palette';
import { CHAR_W, LINE_H, PAD_TOP, PAD_X, CHROME_H, renderTerminal, type Line } from '../render/terminal';

const PROMPT = 'artem@dikmarov ~ % ';
const CMD = 'whoami';

export async function buildHeader(): Promise<string> {
  const lines: Line[] = [
    { spans: [
        { text: PROMPT, color: palette.green, bold: true },
        { text: CMD },
      ] },
    { spans: [{ text: `${config.name} — ${config.role} @ ${config.company}`, bold: true }], class: 'out out1' },
    { spans: [{ text: config.location, color: palette.subtext }], class: 'out out2' },
    { spans: [{ text: config.email, color: palette.blue }], class: 'out out3' },
    { spans: [{ text: PROMPT, color: palette.green, bold: true }], class: 'out out4' },
  ];

  const coverX = PAD_X + PROMPT.length * CHAR_W;
  const coverW = CMD.length * CHAR_W + 4;
  const line0Top = PAD_TOP + CHROME_H + 4;
  const cursorX = coverX; // cursor sits after the final prompt (same column as cmd start)
  const cursorTop = PAD_TOP + CHROME_H + 4 * LINE_H + 4;

  const extraStyles = `
.cover { transform-box: fill-box; transform-origin: 100% 50%;
  animation: type 9s steps(${CMD.length}, end) infinite; }
@keyframes type { 0% { transform: scaleX(1) } 15%, 100% { transform: scaleX(0) } }
.out { opacity: 0; }
.out1 { animation: show1 9s infinite; } @keyframes show1 { 0%,18% {opacity:0} 21%,100% {opacity:1} }
.out2 { animation: show2 9s infinite; } @keyframes show2 { 0%,24% {opacity:0} 27%,100% {opacity:1} }
.out3 { animation: show3 9s infinite; } @keyframes show3 { 0%,30% {opacity:0} 33%,100% {opacity:1} }
.out4 { animation: show4 9s infinite; } @keyframes show4 { 0%,38% {opacity:0} 41%,100% {opacity:1} }
.cursor { animation: blink 1.1s steps(1, end) infinite; }
@keyframes blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }
`;

  const extraElements = `
<rect class="cover" x="${coverX}" y="${line0Top}" width="${coverW}" height="${LINE_H - 6}" fill="${palette.bg}"/>
<g class="out out4"><rect class="cursor" x="${cursorX}" y="${cursorTop}" width="${CHAR_W}" height="${LINE_H - 6}" fill="${palette.text}"/></g>
`;

  return renderTerminal(lines, { showChrome: true, extraStyles, extraElements });
}

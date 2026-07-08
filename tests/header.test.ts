import { describe, expect, it } from 'vitest';
import { buildHeader } from '../scripts/sections/header';
import { CHAR_W, LINE_H, PAD_TOP, PAD_X, CHROME_H } from '../scripts/render/terminal';

describe('buildHeader', () => {
  it('contains prompt, identity lines, and typing animation', async () => {
    const svg = await buildHeader();
    expect(svg).toContain('whoami');
    expect(svg).toContain('Artem Dikmarov');
    expect(svg).toContain('Amsterdam, NL');
    expect(svg).not.toContain('artem@dikmarov.ru');
    expect(svg).toContain('@keyframes type');
    expect(svg).toContain('@keyframes blink');
    expect(svg).toContain('infinite');
  });

  it('positions the typing cover and cursor on the prompt column', async () => {
    const svg = await buildHeader();
    const PROMPT = 'artem@dikmarov ~ % ';
    const coverX = PAD_X + PROMPT.length * CHAR_W;
    const line0Top = PAD_TOP + CHROME_H + 4;
    const cursorTop = PAD_TOP + CHROME_H + 3 * LINE_H + 4;
    expect(svg).toContain(`class="cover" x="${coverX}" y="${line0Top}"`);
    expect(svg).toContain(`class="cursor" x="${coverX}" y="${cursorTop}"`);
  });
});

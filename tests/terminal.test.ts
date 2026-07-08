import { describe, expect, it } from 'vitest';
import { renderTerminal } from '../scripts/render/terminal';
import { palette } from '../scripts/render/palette';

describe('renderTerminal', () => {
  it('produces a self-contained svg with background and text', () => {
    const svg = renderTerminal([{ spans: [{ text: 'hello & <world>' }] }]);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`fill="${palette.bg}"`);
    expect(svg).toContain('hello &amp; &lt;world&gt;');
    expect(svg.substring(svg.indexOf('xmlns') + 60)).not.toMatch(/https?:\/\//); // no external URLs after namespace
  });

  it('renders macOS chrome dots when requested', () => {
    const svg = renderTerminal([{ spans: [{ text: 'x' }] }], { showChrome: true });
    expect(svg.match(/<circle/g)).toHaveLength(3);
  });

  it('applies span color and line class', () => {
    const svg = renderTerminal([
      { spans: [{ text: 'ok', color: palette.green, bold: true }], class: 'out1' },
    ]);
    expect(svg).toContain(`fill="${palette.green}"`);
    expect(svg).toContain('font-weight="600"');
    expect(svg).toContain('class="mono out1"');
  });

  it('preserves leading whitespace for ascii alignment', () => {
    const svg = renderTerminal([{ spans: [{ text: '  indented' }] }]);
    expect(svg).toContain('xml:space="preserve"');
  });
});

import { describe, expect, it } from 'vitest';
import { escapeXml, pad, truncate } from '../scripts/render/text';

describe('escapeXml', () => {
  it('escapes &, <, >, "', () => {
    expect(escapeXml('a<b>&"c"')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('abc', 5)).toBe('abc');
  });
  it('cuts long strings and appends ellipsis within max', () => {
    expect(truncate('abcdefgh', 5)).toBe('abcd…');
    expect(truncate('abcdefgh', 5)).toHaveLength(5);
  });
});

describe('pad', () => {
  it('right-pads to width', () => {
    expect(pad('ab', 5)).toBe('ab   ');
  });
  it('leaves longer strings alone', () => {
    expect(pad('abcdef', 3)).toBe('abcdef');
  });
});

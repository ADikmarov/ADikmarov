import { describe, expect, it } from 'vitest';
import { computeLangStats, renderLangs } from '../scripts/sections/langs';

describe('computeLangStats', () => {
  it('aggregates bytes across repos into rounded percentages', () => {
    const stats = computeLangStats([
      { TypeScript: 750, JavaScript: 150 },
      { TypeScript: 50, Go: 30, Python: 20 },
    ]);
    const ts = stats.find((s) => s.name === 'TypeScript')!;
    expect(ts.pct).toBe(80);
    expect(Number.isInteger(ts.pct)).toBe(true);
  });

  it('never lets rounding exceed 100 in total', () => {
    // three langs at 1/3 each would naively round to 33+33+33 or 34+34+34
    const stats = computeLangStats([{ A: 1, B: 1, C: 1 }]);
    const total = stats.reduce((s, l) => s + l.pct, 0);
    expect(total).toBe(100);
  });

  it('always includes Go and Python even with tiny or zero share', () => {
    const stats = computeLangStats([{ TypeScript: 99_999, Go: 1 }]);
    expect(stats.map((s) => s.name)).toContain('Go');
    expect(stats.map((s) => s.name)).toContain('Python');
    expect(stats.find((s) => s.name === 'Python')!.pct).toBe(0);
  });

  it('caps the list at top 6 plus always-show', () => {
    const stats = computeLangStats([
      { A: 800, B: 700, C: 600, D: 500, E: 400, F: 300, G: 200, H: 100 },
    ]);
    expect(stats.filter((s) => !['Go', 'Python'].includes(s.name))).toHaveLength(6);
  });
});

describe('renderLangs', () => {
  it('renders bars and formats zero as <1%', () => {
    const svg = renderLangs([
      { name: 'TypeScript', pct: 78 },
      { name: 'Python', pct: 0 },
    ]);
    expect(svg).toContain('stats --langs');
    expect(svg).toContain('78%');
    expect(svg).toContain('&lt;1%');
    expect(svg).toContain('█');
    expect(svg).toContain('░');
  });
});

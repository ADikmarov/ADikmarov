import { describe, expect, it } from 'vitest';
import { buildHeader } from '../scripts/sections/header';

describe('buildHeader', () => {
  it('contains prompt, identity lines, and typing animation', async () => {
    const svg = await buildHeader();
    expect(svg).toContain('whoami');
    expect(svg).toContain('Artem Dikmarov');
    expect(svg).toContain('Amsterdam, NL');
    expect(svg).toContain('artem@dikmarov.ru');
    expect(svg).toContain('@keyframes type');
    expect(svg).toContain('@keyframes blink');
    expect(svg).toContain('infinite');
  });
});

import { describe, expect, it } from 'vitest';
import { renderNeofetch, uptimeYears } from '../scripts/sections/neofetch';

const NOW = new Date('2026-07-08T12:00:00Z');

describe('uptimeYears', () => {
  it('counts full years since 2013', () => {
    expect(uptimeYears(NOW)).toBe(13);
  });
});

describe('renderNeofetch', () => {
  const svg = renderNeofetch(NOW);

  it('shows uptime and no repo stats', () => {
    expect(svg).toContain('13 years in production');
    expect(svg).not.toContain('Repos');
  });

  it('shows all profile fields', () => {
    for (const s of ['Role', 'Company', 'Stack', 'AI', 'OS', 'Shell', 'Editor', 'Uptime']) {
      expect(svg).toContain(s);
    }
    expect(svg).not.toContain('artem@dikmarov.ru');
    expect(svg).toContain('Claude Code · LangChain · MCP · RAG');
    expect(svg).toContain('TypeScript, Node.js, React, Go, Python');
  });

  it('contains the ascii art block', () => {
    expect(svg).toContain('█████╗');
  });
});

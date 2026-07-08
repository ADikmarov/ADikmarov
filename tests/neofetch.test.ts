import { describe, expect, it } from 'vitest';
import { renderNeofetch, uptimeYears } from '../scripts/sections/neofetch';

const NOW = new Date('2026-07-08T12:00:00Z');

describe('uptimeYears', () => {
  it('counts full years since 2013', () => {
    expect(uptimeYears(NOW)).toBe(13);
  });
});

describe('renderNeofetch', () => {
  const svg = renderNeofetch({ publicRepos: 42, stars: 137 }, NOW);

  it('shows live repo stats and uptime', () => {
    expect(svg).toContain('42 public · 137 stars');
    expect(svg).toContain('13 years in production');
  });

  it('shows all profile fields', () => {
    for (const s of ['Role', 'Company', 'Stack', 'AI', 'OS', 'Shell', 'Editor', 'Uptime', 'Repos', 'Contact']) {
      expect(svg).toContain(s);
    }
    expect(svg).toContain('Claude Code · LangChain · MCP · RAG');
    expect(svg).toContain('TypeScript, Node.js, React, Go, Python');
  });

  it('contains the ascii art block', () => {
    expect(svg).toContain('█████╗');
  });
});

import { config } from '../config';
import { fetchLanguages, fetchRepos } from '../github';
import { palette } from '../render/palette';
import { pad } from '../render/text';
import { renderTerminal, type Line } from '../render/terminal';

export interface LangStat { name: string; pct: number }

const TOP_N = 6;
const BAR_W = 20;
const NAME_W = 12;

export function computeLangStats(byteMaps: Record<string, number>[]): LangStat[] {
  const totals = new Map<string, number>();
  for (const m of byteMaps) {
    for (const [lang, bytes] of Object.entries(m)) {
      totals.set(lang, (totals.get(lang) ?? 0) + bytes);
    }
  }
  for (const lang of config.alwaysShowLangs) {
    if (!totals.has(lang)) totals.set(lang, 0);
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  if (grand === 0) {
    return [...config.alwaysShowLangs]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, pct: 0 }));
  }

  // largest-remainder rounding over the FULL set so integer shares sum to 100
  const exact = [...totals.entries()].map(([name, bytes]) => ({
    name,
    exact: (bytes / grand) * 100,
  }));
  const floored = exact.map((e) => ({ name: e.name, pct: Math.floor(e.exact), rem: e.exact % 1 }));
  let leftover = 100 - floored.reduce((s, e) => s + e.pct, 0);
  for (const e of [...floored].sort((a, b) => b.rem - a.rem)) {
    if (leftover <= 0) break;
    e.pct += 1;
    leftover -= 1;
  }

  const byBytes = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const shown = new Set([
    ...byBytes.filter((n) => !(config.alwaysShowLangs as readonly string[]).includes(n)).slice(0, TOP_N),
    ...config.alwaysShowLangs,
  ]);

  return floored
    .filter((e) => shown.has(e.name))
    .map(({ name, pct }) => ({ name, pct }))
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
}

export function renderLangs(stats: LangStat[]): string {
  const lines: Line[] = [
    { spans: [
        { text: 'artem@dikmarov ~ % ', color: palette.green, bold: true },
        { text: 'stats --langs' },
      ] },
    ...stats.map((s): Line => {
      const filled = Math.round((s.pct / 100) * BAR_W);
      const label = s.pct === 0 ? '<1%' : `${s.pct}%`;
      return {
        spans: [
          { text: pad(s.name, NAME_W), color: palette.blue },
          { text: '█'.repeat(filled), color: palette.green },
          { text: '░'.repeat(BAR_W - filled), color: palette.surface },
          { text: `  ${label.padStart(4)}`, color: palette.subtext },
        ],
      };
    }),
  ];
  return renderTerminal(lines);
}

export async function buildLangs(): Promise<string> {
  const repos = await fetchRepos();
  const byteMaps = await Promise.all(
    repos.filter((r) => !r.fork).map((r) => fetchLanguages(r.languages_url)),
  );
  return renderLangs(computeLangStats(byteMaps));
}

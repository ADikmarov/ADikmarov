# Terminal Profile README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the template profile README with a self-generated "terminal session" — four SVG blocks (animated header, neofetch card, git-log activity, language stats) refreshed daily by GitHub Actions.

**Architecture:** A TypeScript generator (`scripts/`) renders four SVG files into `assets/`; a shared `renderTerminal()` module gives every block the same terminal window look (Catppuccin Mocha, embedded JetBrains Mono). Live data comes from the GitHub REST API. A daily workflow regenerates the SVGs and commits only when they changed; each block generates independently so one failure never blanks the profile.

**Tech Stack:** Node.js 22, TypeScript, tsx (runner), vitest (tests), GitHub REST API, GitHub Actions.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-08-terminal-profile-readme-design.md`.
- GitHub username: `ADikmarov`. Contact email: `artem@dikmarov.ru`.
- Palette is Catppuccin Mocha; use ONLY the values defined in `scripts/render/palette.ts` (Task 2).
- Career start year constant: `2013`.
- Always-shown languages in the langs block: `Go`, `Python`.
- SVGs must be self-contained: no JS, no external URLs (fonts embedded as base64 data URI with system-monospace fallback). Animations via CSS keyframes only.
- Generator must never write a broken/partial SVG: render fully in memory, write on success only.
- All commit messages in English.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (vitest run), `npm run generate` (tsx scripts/generate.ts — entry added in Task 9). Strict TS config used by all later tasks.

- [ ] **Step 1: Init package and install dev dependencies**

```bash
npm init -y
npm pkg set type=module scripts.test="vitest run" scripts.generate="tsx scripts/generate.ts"
npm i -D typescript tsx vitest @types/node
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["scripts", "tests"]
}
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
```

- [ ] **Step 4: Verify toolchain**

Run: `npx vitest run`
Expected: exits reporting "No test files found" (that's fine — proves vitest runs). Run `npx tsc --noEmit` — exits 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "chore: scaffold TypeScript generator project"
```

---

### Task 2: Palette and text utilities

**Files:**
- Create: `scripts/render/palette.ts`, `scripts/render/text.ts`
- Test: `tests/text.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `palette: { bg, surface, text, subtext, overlay, green, blue, mauve, peach, red, yellow, teal }` — hex strings.
  - `escapeXml(s: string): string`
  - `truncate(s: string, max: number): string` — appends `…` when cut; result length ≤ max.
  - `pad(s: string, width: number): string` — right-pads with spaces; never truncates.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/text.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/text.test.ts`
Expected: FAIL — cannot resolve `../scripts/render/text`.

- [ ] **Step 3: Implement**

```ts
// scripts/render/palette.ts  (Catppuccin Mocha)
export const palette = {
  bg: '#1e1e2e',
  surface: '#313244',
  text: '#cdd6f4',
  subtext: '#a6adc8',
  overlay: '#6c7086',
  green: '#a6e3a1',
  blue: '#89b4fa',
  mauve: '#cba6f7',
  peach: '#fab387',
  red: '#f38ba8',
  yellow: '#f9e2af',
  teal: '#94e2d5',
} as const;
```

```ts
// scripts/render/text.ts
export function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/text.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/render/palette.ts scripts/render/text.ts tests/text.test.ts
git commit -m "feat: add palette and text layout utilities"
```

---

### Task 3: Terminal SVG renderer with embedded font

**Files:**
- Create: `scripts/render/font.ts`, `scripts/render/terminal.ts`, `scripts/render/fonts/JetBrainsMono-Regular.woff2` (downloaded binary)
- Test: `tests/terminal.test.ts`

**Interfaces:**
- Consumes: `palette`, `escapeXml` (Task 2).
- Produces:
  - `interface Span { text: string; color?: string; bold?: boolean }`
  - `interface Line { spans: Span[]; class?: string }`
  - `interface TerminalOptions { width?: number; showChrome?: boolean; extraStyles?: string; extraElements?: string }`
  - `renderTerminal(lines: Line[], opts?: TerminalOptions): string` — full `<svg>` document string.
  - Layout constants: `CHAR_W = 8.4`, `LINE_H = 22`, `PAD_X = 24`, `PAD_TOP = 20` (exported).
  - `fontFace(): string` — `@font-face` CSS with base64 woff2, or `''` if the font file is missing.

- [ ] **Step 1: Download the font**

```bash
mkdir -p scripts/render/fonts
curl -fsSL -o scripts/render/fonts/JetBrainsMono-Regular.woff2 \
  https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/webfonts/JetBrainsMono-Regular.woff2
```

Expected: file ~90 KB exists. (If download fails, proceed — `fontFace()` degrades to `''` and the fallback stack keeps everything monospace.)

- [ ] **Step 2: Write the failing tests**

```ts
// tests/terminal.test.ts
import { describe, expect, it } from 'vitest';
import { renderTerminal } from '../scripts/render/terminal';
import { palette } from '../scripts/render/palette';

describe('renderTerminal', () => {
  it('produces a self-contained svg with background and text', () => {
    const svg = renderTerminal([{ spans: [{ text: 'hello & <world>' }] }]);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`fill="${palette.bg}"`);
    expect(svg).toContain('hello &amp; &lt;world&gt;');
    expect(svg).not.toContain('http://', svg.indexOf('xmlns') + 60); // no external URLs after namespace
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/terminal.test.ts`
Expected: FAIL — cannot resolve `../scripts/render/terminal`.

- [ ] **Step 4: Implement**

```ts
// scripts/render/font.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fontPath = join(dirname(fileURLToPath(import.meta.url)), 'fonts', 'JetBrainsMono-Regular.woff2');

export function fontFace(): string {
  if (!existsSync(fontPath)) return '';
  const b64 = readFileSync(fontPath).toString('base64');
  return `@font-face { font-family: 'JetBrains Mono'; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
}
```

```ts
// scripts/render/terminal.ts
import { palette } from './palette';
import { escapeXml } from './text';
import { fontFace } from './font';

export interface Span { text: string; color?: string; bold?: boolean }
export interface Line { spans: Span[]; class?: string }
export interface TerminalOptions {
  width?: number;
  showChrome?: boolean;
  extraStyles?: string;
  extraElements?: string;
}

export const CHAR_W = 8.4;
export const LINE_H = 22;
export const PAD_X = 24;
export const PAD_TOP = 20;
const CHROME_H = 30;

export function renderTerminal(lines: Line[], opts: TerminalOptions = {}): string {
  const width = opts.width ?? 820;
  const chromeH = opts.showChrome ? CHROME_H : 0;
  const height = PAD_TOP + chromeH + lines.length * LINE_H + PAD_TOP;

  const chrome = opts.showChrome
    ? `<circle cx="${PAD_X + 6}" cy="${PAD_TOP + 6}" r="6" fill="${palette.red}"/>
<circle cx="${PAD_X + 28}" cy="${PAD_TOP + 6}" r="6" fill="${palette.yellow}"/>
<circle cx="${PAD_X + 50}" cy="${PAD_TOP + 6}" r="6" fill="${palette.green}"/>`
    : '';

  const textLines = lines
    .map((line, i) => {
      const y = PAD_TOP + chromeH + (i + 1) * LINE_H - 6;
      const cls = line.class ? `mono ${line.class}` : 'mono';
      const tspans = line.spans
        .map(
          (s) =>
            `<tspan fill="${s.color ?? palette.text}"${s.bold ? ' font-weight="600"' : ''}>${escapeXml(s.text)}</tspan>`,
        )
        .join('');
      return `<text x="${PAD_X}" y="${y}" xml:space="preserve" class="${cls}">${tspans}</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<style>
${fontFace()}
.mono { font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 14px; }
${opts.extraStyles ?? ''}
</style>
<rect width="${width}" height="${height}" rx="12" fill="${palette.bg}"/>
${chrome}
${textLines}
${opts.extraElements ?? ''}
</svg>
`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/terminal.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/render/font.ts scripts/render/terminal.ts scripts/render/fonts tests/terminal.test.ts
git commit -m "feat: add terminal SVG renderer with embedded font"
```

---

### Task 4: Config and GitHub API client

**Files:**
- Create: `scripts/config.ts`, `scripts/github.ts`
- Test: `tests/github.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `config` object (see code — used by every section).
  - `interface Repo { name: string; fork: boolean; stargazers_count: number; languages_url: string }`
  - `interface GhEvent { type: string; created_at: string; repo: { name: string }; payload: any }`
  - `fetchUser(): Promise<{ public_repos: number }>`
  - `fetchRepos(): Promise<Repo[]>`
  - `fetchLanguages(url: string): Promise<Record<string, number>>`
  - `fetchEvents(): Promise<GhEvent[]>`
  - All fetchers throw `Error` with status on non-2xx responses.

- [ ] **Step 1: Write `scripts/config.ts`**

```ts
// scripts/config.ts
export const config = {
  username: 'ADikmarov',
  name: 'Artem Dikmarov',
  role: 'Full-Stack Developer',
  company: 'Osome',
  location: 'Amsterdam, NL',
  email: 'artem@dikmarov.ru',
  stack: ['TypeScript', 'Node.js', 'React', 'Go', 'Python'],
  ai: ['Claude Code', 'LangChain', 'MCP', 'RAG'],
  os: 'macOS',
  shell: 'zsh',
  editor: 'Claude Code',
  careerStartYear: 2013,
  alwaysShowLangs: ['Go', 'Python'],
  links: [
    { label: 'Instagram', url: 'https://instagram.com/tema_d_01' },
    { label: 'Dribbble', url: 'https://dribbble.com/adikmarov' },
    { label: 'LeetCode', url: 'https://leetcode.com/adikmarov' },
  ],
} as const;
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/github.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRepos, fetchUser } from '../scripts/github';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status < 300,
    status,
    json: async () => body,
  })));
}

afterEach(() => vi.unstubAllGlobals());

describe('github client', () => {
  it('returns parsed json on success', async () => {
    mockFetch(200, { public_repos: 12 });
    await expect(fetchUser()).resolves.toEqual({ public_repos: 12 });
  });

  it('throws on non-2xx with status in message', async () => {
    mockFetch(503, {});
    await expect(fetchRepos()).rejects.toThrow(/503/);
  });

  it('sends auth header when GITHUB_TOKEN is set', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok123');
    mockFetch(200, []);
    await fetchRepos();
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers.Authorization).toBe('Bearer tok123');
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/github.test.ts`
Expected: FAIL — cannot resolve `../scripts/github`.

- [ ] **Step 4: Implement**

```ts
// scripts/github.ts
import { config } from './config';

export interface Repo {
  name: string;
  fork: boolean;
  stargazers_count: number;
  languages_url: string;
}

export interface GhEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: any;
}

const API = 'https://api.github.com';

async function ghFetch<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': config.username,
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

export const fetchUser = () =>
  ghFetch<{ public_repos: number }>(`/users/${config.username}`);

export const fetchRepos = () =>
  ghFetch<Repo[]>(`/users/${config.username}/repos?per_page=100&sort=pushed`);

export const fetchLanguages = (url: string) => ghFetch<Record<string, number>>(url);

export const fetchEvents = () =>
  ghFetch<GhEvent[]>(`/users/${config.username}/events/public?per_page=100`);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/github.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/config.ts scripts/github.ts tests/github.test.ts
git commit -m "feat: add config and GitHub API client"
```

---

### Task 5: Animated header section

**Files:**
- Create: `scripts/sections/header.ts`
- Test: `tests/header.test.ts`

**Interfaces:**
- Consumes: `renderTerminal`, `Line`, `CHAR_W`, `PAD_X`, `PAD_TOP`, `LINE_H` (Task 3), `palette` (Task 2), `config` (Task 4).
- Produces: `buildHeader(): Promise<string>` — SVG string (async for a uniform section signature; no network calls inside).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/header.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/header.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

The typing effect: the command text is covered by a bg-colored rect that collapses (`scaleX(1) → scaleX(0)`, origin at its right edge) in character steps; output lines fade in afterwards at staggered points of one 9s master cycle; a final prompt line carries a blinking block cursor.

```ts
// scripts/sections/header.ts
import { config } from '../config';
import { palette } from '../render/palette';
import { CHAR_W, LINE_H, PAD_TOP, PAD_X, renderTerminal, type Line } from '../render/terminal';

const PROMPT = 'artem@dikmarov ~ % ';
const CMD = 'whoami';
const CHROME_H = 30;

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/header.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sections/header.ts tests/header.test.ts
git commit -m "feat: add animated whoami header section"
```

---

### Task 6: Neofetch section

**Files:**
- Create: `scripts/sections/neofetch.ts`
- Test: `tests/neofetch.test.ts`

**Interfaces:**
- Consumes: `renderTerminal`, `palette`, `pad`, `config`, `fetchUser`, `fetchRepos` (Tasks 2–4).
- Produces:
  - `uptimeYears(now: Date): number` — `now.getFullYear() - config.careerStartYear`.
  - `renderNeofetch(data: { publicRepos: number; stars: number }, now: Date): string` — pure, testable.
  - `buildNeofetch(): Promise<string>` — fetches data, delegates to `renderNeofetch`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/neofetch.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/neofetch.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// scripts/sections/neofetch.ts
import { config } from '../config';
import { fetchRepos, fetchUser } from '../github';
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

export function renderNeofetch(data: { publicRepos: number; stars: number }, now: Date): string {
  const fields: Array<[string, string, string?]> = [
    ['Role', config.role],
    ['Company', config.company],
    ['Stack', config.stack.join(', ')],
    ['AI', config.ai.join(' · '), palette.mauve],
    ['OS', config.os],
    ['Shell', config.shell],
    ['Editor', config.editor],
    ['Uptime', `${uptimeYears(now)} years in production`, palette.green],
    ['Repos', `${data.publicRepos} public · ${data.stars} stars`, palette.yellow],
    ['Contact', config.email, palette.blue],
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
  const [user, repos] = await Promise.all([fetchUser(), fetchRepos()]);
  const stars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
  return renderNeofetch({ publicRepos: user.public_repos, stars }, new Date());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/neofetch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sections/neofetch.ts tests/neofetch.test.ts
git commit -m "feat: add neofetch profile section"
```

---

### Task 7: Language stats section

**Files:**
- Create: `scripts/sections/langs.ts`
- Test: `tests/langs.test.ts`

**Interfaces:**
- Consumes: `renderTerminal`, `palette`, `pad`, `config`, `fetchRepos`, `fetchLanguages` (Tasks 2–4).
- Produces:
  - `interface LangStat { name: string; pct: number }` — `pct` is an integer; `0` renders as `<1%`.
  - `computeLangStats(byteMaps: Record<string, number>[]): LangStat[]` — top 6 by bytes ∪ always-show langs; integer percentages via largest-remainder (full set sums to exactly 100); sorted by pct desc, then name.
  - `renderLangs(stats: LangStat[]): string` — pure.
  - `buildLangs(): Promise<string>`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/langs.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/langs.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// scripts/sections/langs.ts
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
  const grand = [...totals.values()].reduce((a, b) => a + b, 0) || 1;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/langs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sections/langs.ts tests/langs.test.ts
git commit -m "feat: add language stats section"
```

---

### Task 8: Activity section

**Files:**
- Create: `scripts/sections/activity.ts`
- Test: `tests/activity.test.ts`

**Interfaces:**
- Consumes: `renderTerminal`, `palette`, `pad`, `truncate`, `fetchEvents`, `GhEvent` (Tasks 2–4).
- Produces:
  - `relativeTime(iso: string, now: Date): string` — `today` / `yesterday` / `N days ago` / `N weeks ago` / `N months ago`.
  - `eventToMessage(e: GhEvent): string | null` — `null` for unsupported event types.
  - `renderActivity(items: Array<{ msg: string; when: string }>): string` — pure.
  - `buildActivity(): Promise<string>` — maps events, keeps first 7.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/activity.test.ts
import { describe, expect, it } from 'vitest';
import { eventToMessage, relativeTime, renderActivity } from '../scripts/sections/activity';

const NOW = new Date('2026-07-08T12:00:00Z');

describe('relativeTime', () => {
  it.each([
    ['2026-07-08T09:00:00Z', 'today'],
    ['2026-07-07T09:00:00Z', 'yesterday'],
    ['2026-07-05T09:00:00Z', '3 days ago'],
    ['2026-06-20T09:00:00Z', '2 weeks ago'],
    ['2026-04-01T09:00:00Z', '3 months ago'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeTime(iso, NOW)).toBe(expected);
  });
});

describe('eventToMessage', () => {
  const base = { created_at: '2026-07-06T00:00:00Z', repo: { name: 'ADikmarov/proj' } };

  it('maps push events with commit count', () => {
    expect(eventToMessage({ ...base, type: 'PushEvent', payload: { commits: [{}, {}, {}] } }))
      .toBe('pushed 3 commits to ADikmarov/proj');
  });

  it('maps opened pull requests', () => {
    expect(eventToMessage({ ...base, type: 'PullRequestEvent', payload: { action: 'opened', number: 7 } }))
      .toBe('opened PR ADikmarov/proj#7');
  });

  it('maps repository creation and releases', () => {
    expect(eventToMessage({ ...base, type: 'CreateEvent', payload: { ref_type: 'repository' } }))
      .toBe('created repository ADikmarov/proj');
    expect(eventToMessage({ ...base, type: 'ReleaseEvent', payload: { release: { tag_name: 'v1.2.0' } } }))
      .toBe('released v1.2.0 in ADikmarov/proj');
  });

  it('returns null for unsupported types', () => {
    expect(eventToMessage({ ...base, type: 'GollumEvent', payload: {} })).toBeNull();
  });
});

describe('renderActivity', () => {
  it('renders the git log command and entries with dates', () => {
    const svg = renderActivity([{ msg: 'pushed 2 commits to a/b', when: '2 days ago' }]);
    expect(svg).toContain('git log --oneline');
    expect(svg).toContain('pushed 2 commits to a/b');
    expect(svg).toContain('2 days ago');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/activity.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// scripts/sections/activity.ts
import { fetchEvents, type GhEvent } from '../github';
import { palette } from '../render/palette';
import { pad, truncate } from '../render/text';
import { renderTerminal, type Line } from '../render/terminal';

const MAX_ITEMS = 7;
const MSG_W = 58;

export function relativeTime(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function eventToMessage(e: GhEvent): string | null {
  switch (e.type) {
    case 'PushEvent': {
      const n = e.payload.commits?.length ?? 0;
      return `pushed ${n} commit${n === 1 ? '' : 's'} to ${e.repo.name}`;
    }
    case 'PullRequestEvent':
      if (e.payload.action === 'opened') return `opened PR ${e.repo.name}#${e.payload.number}`;
      if (e.payload.action === 'closed' && e.payload.pull_request?.merged)
        return `merged PR ${e.repo.name}#${e.payload.number}`;
      return null;
    case 'CreateEvent':
      return e.payload.ref_type === 'repository' ? `created repository ${e.repo.name}` : null;
    case 'ReleaseEvent':
      return `released ${e.payload.release.tag_name} in ${e.repo.name}`;
    case 'WatchEvent':
      return `starred ${e.repo.name}`;
    default:
      return null;
  }
}

export function renderActivity(items: Array<{ msg: string; when: string }>): string {
  const lines: Line[] = [
    { spans: [
        { text: 'artem@dikmarov ~ % ', color: palette.green, bold: true },
        { text: 'git log --oneline' },
      ] },
    ...items.map((it): Line => ({
      spans: [
        { text: '* ', color: palette.peach, bold: true },
        { text: pad(truncate(it.msg, MSG_W), MSG_W + 2) },
        { text: it.when, color: palette.subtext },
      ],
    })),
  ];
  return renderTerminal(lines);
}

export async function buildActivity(): Promise<string> {
  const events = await fetchEvents();
  const now = new Date();
  const items = events
    .map((e) => {
      const msg = eventToMessage(e);
      return msg ? { msg, when: relativeTime(e.created_at, now) } : null;
    })
    .filter((x): x is { msg: string; when: string } => x !== null)
    .slice(0, MAX_ITEMS);
  return renderActivity(items);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/activity.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sections/activity.ts tests/activity.test.ts
git commit -m "feat: add git-log activity section"
```

---

### Task 9: Generator entry point

**Files:**
- Create: `scripts/generate.ts`

**Interfaces:**
- Consumes: `buildHeader`, `buildNeofetch`, `buildActivity`, `buildLangs` (Tasks 5–8).
- Produces: `npm run generate` writes `assets/header.svg`, `assets/neofetch.svg`, `assets/activity.svg`, `assets/langs.svg`. Exit code 0 when all sections succeed, 1 when any fail (successful sections are still written — one failure must not blank the others).

- [ ] **Step 1: Implement**

```ts
// scripts/generate.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildActivity } from './sections/activity';
import { buildHeader } from './sections/header';
import { buildLangs } from './sections/langs';
import { buildNeofetch } from './sections/neofetch';

const sections: Array<[string, () => Promise<string>]> = [
  ['header', buildHeader],
  ['neofetch', buildNeofetch],
  ['activity', buildActivity],
  ['langs', buildLangs],
];

mkdirSync('assets', { recursive: true });

let failed = 0;
for (const [name, build] of sections) {
  try {
    const svg = await build();
    writeFileSync(`assets/${name}.svg`, svg);
    console.log(`✓ assets/${name}.svg`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

if (failed > 0) {
  console.error(`${failed} section(s) failed — keeping previous versions.`);
  process.exit(1);
}
```

- [ ] **Step 2: Verify against the live API**

Run: `npm run generate`
Expected: four `✓ assets/*.svg` lines, exit 0 (unauthenticated rate limit is 60 req/h — enough for one run; if you hit 403, export a token: `GITHUB_TOKEN=$(gh auth token) npm run generate`).

Then run the full suite: `npx vitest run` — all tests PASS, and `npx tsc --noEmit` — exit 0.

- [ ] **Step 3: Commit (generator only — assets are reviewed visually in Task 11 first)**

```bash
git add scripts/generate.ts
git commit -m "feat: add SVG generator entry point"
```

---

### Task 10: README rewrite and daily workflow

**Files:**
- Modify: `README.md` (full replacement)
- Create: `.github/workflows/update-readme.yml`

**Interfaces:**
- Consumes: `assets/*.svg` paths (Task 9), `npm run generate`.
- Produces: the public profile page; a scheduled workflow that regenerates and commits.

- [ ] **Step 1: Replace `README.md` entirely with:**

```markdown
<p align="center"><img src="assets/header.svg" alt="artem@dikmarov ~ % whoami — Artem Dikmarov, Full-Stack Developer @ Osome, Amsterdam NL"></p>

<p align="center"><img src="assets/neofetch.svg" alt="Profile card: role, company, stack, AI tooling, OS, shell, editor, uptime, repo stats, contact"></p>

<p align="center"><img src="assets/activity.svg" alt="Recent GitHub activity as git log output"></p>

<p align="center"><img src="assets/langs.svg" alt="Language distribution across public repositories"></p>

<p align="center">
  <a href="https://instagram.com/tema_d_01">Instagram</a> ·
  <a href="https://dribbble.com/adikmarov">Dribbble</a> ·
  <a href="https://leetcode.com/adikmarov">LeetCode</a>
</p>

<p align="center"><sub>generated daily by <a href=".github/workflows/update-readme.yml">GitHub Actions</a> · no templates were harmed</sub></p>
```

- [ ] **Step 2: Write `.github/workflows/update-readme.yml`**

```yaml
name: Update profile

on:
  schedule:
    - cron: '0 5 * * *' # daily, morning in Europe/Amsterdam
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - id: generate
        run: npm run generate
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        continue-on-error: true # partial success still commits; failure surfaces below

      - name: Commit refreshed assets
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add assets
          if git diff --cached --quiet; then
            echo "No changes."
          else
            git commit -m "chore: refresh profile ($(date -u +%F))"
            git push
          fi

      - name: Surface generation failure
        if: steps.generate.outcome == 'failure'
        run: |
          echo "::error::One or more sections failed to generate — see the generate step."
          exit 1
```

- [ ] **Step 3: Validate the workflow YAML**

Run: `npx --yes yaml-lint .github/workflows/update-readme.yml` (or `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/update-readme.yml'))"`).
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/update-readme.yml
git commit -m "feat: terminal-style README with daily refresh workflow"
```

---

### Task 11: Visual verification and first publish

**Files:**
- Create: `assets/header.svg`, `assets/neofetch.svg`, `assets/activity.svg`, `assets/langs.svg` (generated)

**Interfaces:**
- Consumes: everything above.
- Produces: the live profile.

- [ ] **Step 1: Regenerate and inspect locally**

```bash
npm run generate
open assets/header.svg assets/neofetch.svg assets/activity.svg assets/langs.svg
```

Check in the browser: typing animation loops with a pause; cursor blinks; neofetch columns align; bars align; no text overflows the right edge. Fix layout constants (`MSG_W`, `NAME_W`, terminal `width`) if anything overflows, re-running `npx vitest run` after changes.

- [ ] **Step 2: Commit assets and push**

```bash
git add assets
git commit -m "feat: publish generated profile assets"
git push
```

- [ ] **Step 3: Verify on GitHub**

Open `https://github.com/ADikmarov` in light AND dark theme: all four blocks render, animation plays, fonts look monospace. Then trigger the workflow once: `gh workflow run update-readme.yml` and confirm a green run (`gh run watch`) that either commits or reports "No changes."

---

## Self-Review Notes

- Spec coverage: header animation (T5), neofetch fields incl. AI/OS/Shell/Editor/Uptime-2013 (T6), langs rounding + Go/Python always shown (T7), activity git-log (T8), independent sections + exit-code contract (T9), README footer + komarev/streak removal via full rewrite + workflow with no-change/no-commit (T10), light/dark + visual checks (T11). Embedded font with graceful fallback (T3).
- Type consistency: `Line`/`Span` defined once in T3 and imported everywhere; `build*(): Promise<string>` uniform across sections; `GhEvent`/`Repo` from T4 used in T7/T8.

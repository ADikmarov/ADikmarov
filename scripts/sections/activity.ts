import { fetchContributions, fetchEvents, type Contributions, type GhEvent } from '../github';
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
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? '' : 's'} ago`;
  }
  const m = Math.floor(days / 30);
  return `${m} month${m === 1 ? '' : 's'} ago`;
}

export function eventToMessage(e: GhEvent): string | null {
  switch (e.type) {
    case 'PushEvent': {
      // The public events API often trims push payloads to nothing — fall back gracefully
      const n = e.payload.size ?? e.payload.commits?.length ?? 0;
      return n > 0
        ? `pushed ${n} commit${n === 1 ? '' : 's'} to ${e.repo.name}`
        : `pushed to ${e.repo.name}`;
    }
    case 'PullRequestEvent':
      if (e.payload.action === 'opened') return `opened PR ${e.repo.name}#${e.payload.number}`;
      if (e.payload.action === 'closed' && e.payload.pull_request?.merged)
        return `merged PR ${e.repo.name}#${e.payload.number}`;
      return null;
    case 'CreateEvent':
      return e.payload.ref_type === 'repository' ? `created repository ${e.repo.name}` : null;
    case 'ReleaseEvent':
      return e.payload.release?.tag_name
        ? `released ${e.payload.release.tag_name} in ${e.repo.name}`
        : null;
    case 'WatchEvent':
      return `starred ${e.repo.name}`;
    default:
      return null;
  }
}

export function dedupeConsecutive(
  items: Array<{ msg: string; when: string }>,
): Array<{ msg: string; when: string }> {
  // Consecutive same-message runs collapse to the newest occurrence
  return items.filter((it, i) => i === 0 || it.msg !== items[i - 1].msg);
}

export function contributionsLine(c: Contributions): string {
  const priv = c.restricted > 0 ? ` · ${c.restricted} in private repos` : '';
  return `# ${c.total} contributions in the last year${priv}`;
}

export function renderActivity(
  items: Array<{ msg: string; when: string }>,
  summary?: string | null,
): string {
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
  if (summary) {
    lines.push({ spans: [{ text: summary, color: palette.overlay }] });
  }
  return renderTerminal(lines);
}

export async function buildActivity(): Promise<string> {
  const [events, contribs] = await Promise.all([
    fetchEvents(),
    fetchContributions().catch(() => null), // summary is optional — never fail the section over it
  ]);
  const now = new Date();
  const items = dedupeConsecutive(
    events
      .map((e) => {
        const msg = eventToMessage(e);
        return msg ? { msg, when: relativeTime(e.created_at, now) } : null;
      })
      .filter((x): x is { msg: string; when: string } => x !== null),
  ).slice(0, MAX_ITEMS);
  return renderActivity(items, contribs ? contributionsLine(contribs) : null);
}

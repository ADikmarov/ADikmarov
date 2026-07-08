import { describe, expect, it } from 'vitest';
import { contributionsLine, dedupeConsecutive, eventToMessage, relativeTime, renderActivity } from '../scripts/sections/activity';

const NOW = new Date('2026-07-08T12:00:00Z');

describe('relativeTime', () => {
  it.each([
    ['2026-07-08T09:00:00Z', 'today'],
    ['2026-07-07T09:00:00Z', 'yesterday'],
    ['2026-07-05T09:00:00Z', '3 days ago'],
    ['2026-07-01T09:00:00Z', '1 week ago'],
    ['2026-06-25T13:00:00Z', '1 week ago'],
    ['2026-06-20T09:00:00Z', '2 weeks ago'],
    ['2026-06-08T09:00:00Z', '1 month ago'],
    ['2026-04-01T09:00:00Z', '3 months ago'],
    ['2026-07-09T09:00:00Z', 'today'],
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

  it('uses payload.size when the commits array is absent', () => {
    expect(eventToMessage({ ...base, type: 'PushEvent', payload: { size: 2 } }))
      .toBe('pushed 2 commits to ADikmarov/proj');
  });

  it('omits the count for trimmed push payloads (public events API)', () => {
    expect(eventToMessage({ ...base, type: 'PushEvent', payload: {} }))
      .toBe('pushed to ADikmarov/proj');
  });

  it('maps opened pull requests', () => {
    expect(eventToMessage({ ...base, type: 'PullRequestEvent', payload: { action: 'opened', number: 7 } }))
      .toBe('opened PR ADikmarov/proj#7');
  });

  it('maps merged pull requests', () => {
    expect(eventToMessage({ ...base, type: 'PullRequestEvent', payload: { action: 'closed', number: 3, pull_request: { merged: true } } }))
      .toBe('merged PR ADikmarov/proj#3');
  });

  it('returns null for closed but not merged pull requests', () => {
    expect(eventToMessage({ ...base, type: 'PullRequestEvent', payload: { action: 'closed', number: 5 } }))
      .toBeNull();
  });

  it('maps repository creation and releases', () => {
    expect(eventToMessage({ ...base, type: 'CreateEvent', payload: { ref_type: 'repository' } }))
      .toBe('created repository ADikmarov/proj');
    expect(eventToMessage({ ...base, type: 'ReleaseEvent', payload: { release: { tag_name: 'v1.2.0' } } }))
      .toBe('released v1.2.0 in ADikmarov/proj');
  });

  it('returns null for branch creation', () => {
    expect(eventToMessage({ ...base, type: 'CreateEvent', payload: { ref_type: 'branch' } }))
      .toBeNull();
  });

  it('maps watch events (stars)', () => {
    expect(eventToMessage({ ...base, type: 'WatchEvent', payload: {} }))
      .toBe('starred ADikmarov/proj');
  });

  it('returns null for release event with empty payload (no crash)', () => {
    expect(eventToMessage({ ...base, type: 'ReleaseEvent', payload: {} }))
      .toBeNull();
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

  it('renders git log command with empty items and does not throw', () => {
    const svg = renderActivity([]);
    expect(svg).toContain('git log --oneline');
  });

  it('renders the contributions summary line when provided', () => {
    const svg = renderActivity(
      [{ msg: 'pushed 2 commits to a/b', when: '2 days ago' }],
      '# 1234 contributions in the last year · 856 in private repos',
    );
    expect(svg).toContain('# 1234 contributions in the last year · 856 in private repos');
  });

  it('omits the summary line when null', () => {
    const svg = renderActivity([], null);
    expect(svg).not.toContain('contributions in the last year');
  });
});

describe('dedupeConsecutive', () => {
  it('collapses consecutive items with the same message, keeping the newest', () => {
    const items = [
      { msg: 'pushed to a/b', when: 'today' },
      { msg: 'pushed to a/b', when: 'today' },
      { msg: 'pushed to a/b', when: 'yesterday' },
      { msg: 'opened PR a/b#1', when: 'yesterday' },
      { msg: 'pushed to a/b', when: '3 days ago' },
    ];
    expect(dedupeConsecutive(items)).toEqual([
      { msg: 'pushed to a/b', when: 'today' },
      { msg: 'opened PR a/b#1', when: 'yesterday' },
      { msg: 'pushed to a/b', when: '3 days ago' },
    ]);
  });
});

describe('contributionsLine', () => {
  it('mentions private repos when restricted count is positive', () => {
    expect(contributionsLine({ total: 1234, restricted: 856 }))
      .toBe('# 1234 contributions in the last year · 856 in private repos');
  });

  it('omits the private part when restricted count is zero', () => {
    expect(contributionsLine({ total: 42, restricted: 0 }))
      .toBe('# 42 contributions in the last year');
  });
});

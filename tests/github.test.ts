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

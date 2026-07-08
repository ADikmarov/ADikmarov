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

export interface Contributions {
  total: number;
  restricted: number;
}

// Contribution counters are the only public signal of private-repo work;
// `restricted` stays 0 unless the profile enables "Include private contributions".
export async function fetchContributions(): Promise<Contributions | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null; // GraphQL API requires auth
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': config.username,
    },
    body: JSON.stringify({
      query: `query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar { totalContributions }
            restrictedContributionsCount
          }
        }
      }`,
      variables: { login: config.username },
    }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const body = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar: { totalContributions: number };
          restrictedContributionsCount: number;
        };
      };
    };
  };
  const cc = body.data?.user?.contributionsCollection;
  if (!cc) throw new Error('GitHub GraphQL: malformed response');
  return {
    total: cc.contributionCalendar.totalContributions,
    restricted: cc.restrictedContributionsCount,
  };
}

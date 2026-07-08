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

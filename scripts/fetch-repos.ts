/**
 * Fetches ~3,000 non-fork GitHub repositories across a wide star spread (20–100k+) and stores them in SQLite.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... ts-node fetch-repos.ts
 *
 * WARNING: This takes 30–60 minutes due to GitHub API rate limits (5,000 req/hr authenticated).
 * Re-run to upsert: existing rows are updated, no duplicates created.
 */

import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import https from 'https';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import fs from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('FATAL: GITHUB_TOKEN env var required');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'starguessr.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    description TEXT,
    stars INTEGER NOT NULL DEFAULT 0,
    language TEXT,
    created_at TEXT NOT NULL,
    topics TEXT NOT NULL DEFAULT '[]',
    license TEXT,
    default_branch TEXT NOT NULL DEFAULT 'main',
    file_tree TEXT NOT NULL DEFAULT '[]',
    commits TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_repos_stars ON repos(stars DESC);
`);

interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  language: string | null;
  created_at: string;
  topics: string[];
  license: { spdx_id: string; name: string } | null;
  fork: boolean;
  default_branch: string;
}

interface GHCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
}

interface GHTreeItem {
  path: string;
  type: string; // 'blob' | 'tree'
  sha: string;
}

interface GHTree {
  tree: GHTreeItem[];
  truncated: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpsGet(url: string, headers: Record<string, string> = {}, timeoutMs: number = 30000): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'star-guessr-fetch/1.0',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...headers,
      },
    };

    const req = https.request(options, res => {
      let body = '';
      res.setEncoding('utf8');
      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('Response timeout'));
      }, timeoutMs);

      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timeout);
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string>,
          body,
        });
      });
    });
    req.on('error', reject);
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, timeoutMs);
    req.end();
  });
}

async function apiGet<T>(url: string, rawAccept?: string, timeoutMs?: number): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers: Record<string, string> = {};
    if (rawAccept) headers['Accept'] = rawAccept;

    try {
      const resp = await httpsGet(url, headers, timeoutMs ?? 30000);

      if (resp.status === 200) {
        try {
          return JSON.parse(resp.body) as T;
        } catch {
          return null;
        }
      }

      if (resp.status === 403 || resp.status === 429) {
        const retryAfter = resp.headers['retry-after'];
        const resetAt = resp.headers['x-ratelimit-reset'];
        let waitMs = 60_000;
        if (retryAfter) waitMs = parseInt(retryAfter, 10) * 1000;
        else if (resetAt) waitMs = Math.max(0, parseInt(resetAt, 10) * 1000 - Date.now()) + 2000;
        console.log(`  Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s…`);
        await sleep(waitMs);
        continue;
      }

      if (resp.status === 404 || resp.status === 451) return null;
      if (resp.status >= 500) { await sleep(5_000); continue; }

      return null;
    } catch (err) {
      if (attempt === 2) return null;  // Give up after 3 attempts
      console.log(`  Timeout/error on attempt ${attempt + 1}, retrying…`);
      await sleep(3_000);
    }
  }
  return null;
}

function buildRootTree(items: GHTreeItem[]): object[] {
  return items.map(item => ({
    name: item.path,
    type: item.type === 'tree' ? 'tree' : 'blob',
    path: item.path,
    sha: item.sha,
  }));
}

const upsert = db.prepare(`
  INSERT INTO repos (id, name, owner, description, stars, language, created_at, topics, license, default_branch, file_tree, commits, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    owner = excluded.owner,
    description = excluded.description,
    stars = excluded.stars,
    language = excluded.language,
    created_at = excluded.created_at,
    topics = excluded.topics,
    license = excluded.license,
    default_branch = excluded.default_branch,
    file_tree = excluded.file_tree,
    commits = excluded.commits,
    updated_at = CURRENT_TIMESTAMP
`);

async function fetchAndStore(repo: GHRepo, progress: string): Promise<void> {
  const owner = repo.owner.login;
  const name = repo.name;
  const base = `https://api.github.com/repos/${owner}/${name}`;

  const log = (step: string) => process.stdout.write(`\r  ${progress} ${owner}/${name} — ${step}`.padEnd(80));

  // Fetch root-level tree only (non-recursive, fast)
  log('tree…');
  const treeResp = await apiGet<GHTree>(`${base}/git/trees/${repo.default_branch}`, undefined, 60000);
  const fileTree = treeResp ? buildRootTree(treeResp.tree) : [];

  // Last 10 commits
  log('commits…');
  const commitsResp = await apiGet<GHCommit[]>(`${base}/commits?per_page=10`);
  if (!commitsResp) console.warn(`\n  Warning: no commits for ${owner}/${name}`);
  const commits = (commitsResp ?? []).map(c => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.trim(),
    author: c.commit.author?.name ?? 'Unknown',
    date: c.commit.author?.date ?? '',
  }));

  upsert.run(
    repo.id,
    repo.name,
    owner,
    repo.description ?? null,
    repo.stargazers_count,
    repo.language ?? null,
    repo.created_at,
    JSON.stringify(repo.topics ?? []),
    repo.license?.spdx_id ?? null,
    repo.default_branch || 'main',
    JSON.stringify(fileTree),
    JSON.stringify(commits)
  );
}

async function searchRepos(query: string, page: number): Promise<{ items: GHRepo[]; total_count: number }> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=100&page=${page}`;
  const result = await apiGet<{ items: GHRepo[]; total_count: number }>(url);
  return result ?? { items: [], total_count: 0 };
}

// Star ranges to cover ~3,000 repos across a wide spread (30–100k+).
// Each range is capped at 3 pages (300 repos), 10 ranges × 300 = ~3,000 total.
const STAR_RANGES = [
  'stars:>100000',
  'stars:40000..99999',
  'stars:15000..39999',
  'stars:6000..14999',
  'stars:2500..5999',
  'stars:1000..2499',
  'stars:400..999',
  'stars:150..399',
  'stars:60..149',
  'stars:20..59',
];

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const DRY_RUN_LIMIT = 50;

  if (isDryRun) {
    console.log(`StarGuessr — DRY RUN (first ${DRY_RUN_LIMIT} repos only)\n`);
  } else {
    console.log('StarGuessr — Fetching repos from GitHub…');
    console.log('This will take 30–60 minutes due to API rate limits.\n');
  }

  let totalFetched = 0;
  let totalStored = 0;

  const rangesToProcess = isDryRun ? STAR_RANGES.slice(0, 1) : STAR_RANGES;

  for (const range of rangesToProcess) {
    console.log(`\nFetching: ${range}`);
    let page = 1;
    let rangeCount = 0;
    let pagesFetched = 0;

    try {
      while (page <= 3) { // max 300 per range
        const { items } = await searchRepos(`fork:false ${range}`, page);
        if (items.length === 0) {
          console.log(`  No more items at page ${page}. Ending range.`);
          break;
        }

      for (const repo of items) {
        if (repo.fork) continue;
        if (totalFetched >= DRY_RUN_LIMIT && isDryRun) break;

        try {
          const progress = `[${totalFetched + 1}]`;
          await fetchAndStore(repo, progress);
          process.stdout.write(`\r  [${totalFetched + 1}] ${repo.full_name} — done\n`);
          totalStored++;
        } catch (err) {
          process.stdout.write('\n');
          console.warn(`  Warning: failed to fetch details for ${repo.full_name}:`, err);
        }

        totalFetched++;
        if (!isDryRun && totalFetched % 100 === 0) {
          console.log(`  Progress: ${totalFetched} repos processed, ${totalStored} stored`);
        }

        // Respect rate limits: ~1 req/s for detailed fetches (3 req each → ~3/s)
        await sleep(800);
      }

      rangeCount += items.length;
      pagesFetched++;
      console.log(`  Page ${page}: ${items.length} items (range total so far: ${rangeCount})`);
      
      if (items.length < 100) {
        console.log(`  Fewer than 100 items on page ${page}, moving to next range.`);
        break;
      }
      if (isDryRun && totalFetched >= DRY_RUN_LIMIT) break;
      page++;

      // Brief pause between pages
      await sleep(1000);
    }

    console.log(`  Fetched ${rangeCount} repos across ${pagesFetched} pages in range "${range}"`);

    const currentCount = db.prepare('SELECT COUNT(*) as cnt FROM repos').get() as { cnt: number };
    console.log(`  Total in DB: ${currentCount.cnt}`);
    } catch (rangeError) {
      console.error(`ERROR processing range "${range}":`, rangeError);
      console.log(`  Partial progress: ${totalFetched} repos fetched, ${totalStored} stored`);
      console.log(`  Continuing to next range…\n`);
      continue;  // Continue to next range even if this one failed
    }
  }

  const finalCount = db.prepare('SELECT COUNT(*) as cnt FROM repos').get() as { cnt: number };
  console.log(`\nDone! ${finalCount.cnt} repos stored in ${DB_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

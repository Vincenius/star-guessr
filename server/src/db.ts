import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'starguessr.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  migrateSchema(_db);
  return _db;
}

function migrateSchema(db: Database.Database): void {
  const cols = (db.pragma('table_info(repos)') as { name: string }[]).map(c => c.name);
  if (cols.includes('readme')) {
    db.exec('ALTER TABLE repos DROP COLUMN readme');
  }
  if (!cols.includes('default_branch')) {
    db.exec("ALTER TABLE repos ADD COLUMN default_branch TEXT NOT NULL DEFAULT 'main'");
  }
  db.exec("UPDATE leaderboard SET mode = 'freeplay' WHERE mode = 'unlimited'");
}

function initSchema(db: Database.Database): void {
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

    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      score INTEGER NOT NULL,
      mode TEXT NOT NULL,
      date TEXT NOT NULL,
      game_date TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_leaderboard_mode ON leaderboard(mode);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_game_date ON leaderboard(game_date);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
  `);
}

export function getDailyRepoIds(date: string, count = 5): number[] {
  const db = getDb();
  const allIds = db.prepare('SELECT id FROM repos ORDER BY stars DESC LIMIT 2000').all() as { id: number }[];
  if (allIds.length === 0) return [];

  let hash = 5381;
  for (const ch of date) {
    hash = ((hash << 5) + hash) ^ ch.charCodeAt(0);
    hash = hash >>> 0;
  }

  const shuffled = allIds.map(r => r.id);
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    const j = hash % (i + 1);
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  return shuffled.slice(0, count);
}

export function getRandomRepoIds(count = 5, exclude: number[] = []): number[] {
  const db = getDb();
  const excludeSet = new Set(exclude);
  const allIds = db
    .prepare('SELECT id FROM repos ORDER BY RANDOM() LIMIT ?')
    .all(count + excludeSet.size + 50) as { id: number }[];

  const result: number[] = [];
  for (const row of allIds) {
    if (!excludeSet.has(row.id)) {
      result.push(row.id);
      if (result.length >= count) break;
    }
  }
  return result;
}

export function getReposByIds(ids: number[]): import('./types').RepoRecord[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM repos WHERE id IN (${placeholders})`).all(...ids) as import('./types').RepoRecord[];
  const map = new Map(rows.map(r => [r.id, r]));
  return ids.map(id => map.get(id)).filter((r): r is import('./types').RepoRecord => r !== undefined);
}

export function getRepoStars(id: number): number | null {
  const db = getDb();
  const row = db.prepare('SELECT stars FROM repos WHERE id = ?').get(id) as { stars: number } | undefined;
  return row ? row.stars : null;
}

export function insertLeaderboardEntry(
  nickname: string,
  score: number,
  mode: string,
  game_date: string | null
): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO leaderboard (nickname, score, mode, date, game_date) VALUES (?, ?, ?, ?, ?)')
    .run(nickname, score, mode, now, game_date);
  return result.lastInsertRowid as number;
}

export function getDailyLeaderboard(date: string): import('./types').LeaderboardEntry[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM leaderboard WHERE mode = ? AND game_date = ? ORDER BY score DESC LIMIT 20')
    .all('daily', date) as import('./types').LeaderboardEntry[];
}

export function getDailyAlltimeLeaderboard(): import('./types').LeaderboardEntry[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM leaderboard WHERE mode = ? ORDER BY score DESC LIMIT 20')
    .all('daily') as import('./types').LeaderboardEntry[];
}

export function getFreeplayLeaderboard(): import('./types').LeaderboardEntry[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM leaderboard WHERE mode = ? ORDER BY score DESC LIMIT 50')
    .all('freeplay') as import('./types').LeaderboardEntry[];
}

export function getDailyRank(score: number, date: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM leaderboard WHERE mode = ? AND game_date = ? AND score > ?')
    .get('daily', date, score) as { cnt: number };
  return row.cnt + 1;
}

export function getFreeplayRank(score: number): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM leaderboard WHERE mode = ? AND score > ?')
    .get('freeplay', score) as { cnt: number };
  return row.cnt + 1;
}

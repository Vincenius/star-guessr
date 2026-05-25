import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDailyRepoIds, getRandomRepoIds, getReposByIds } from '../db';
import { RepoForGame, RepoRecord, SessionPayload } from '../types';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toRepoForGame(r: RepoRecord): RepoForGame {
  return {
    id: r.id,
    name: r.name,
    owner: r.owner,
    description: r.description,
    language: r.language,
    created_at: r.created_at,
    topics: JSON.parse(r.topics || '[]') as string[],
    license: r.license,
    file_tree: JSON.parse(r.file_tree || '[]'),
    commits: JSON.parse(r.commits || '[]'),
  };
}

router.get('/', (req: Request, res: Response) => {
  const mode = req.query.mode as string;
  const date = req.query.date as string | undefined;

  if (mode !== 'daily' && mode !== 'unlimited') {
    res.status(400).json({ error: 'mode must be "daily" or "unlimited"' });
    return;
  }

  let repoIds: number[];
  let game_date: string | undefined;

  if (mode === 'daily') {
    if (!date || !DATE_RE.test(date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD for daily mode' });
      return;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      res.status(400).json({ error: 'Invalid date' });
      return;
    }
    game_date = date;
    repoIds = getDailyRepoIds(date, 5);
  } else {
    repoIds = getRandomRepoIds(5);
  }

  const records = getReposByIds(repoIds);
  if (records.length === 0) {
    res.status(503).json({ error: 'No repos available. Run the fetch script first.' });
    return;
  }

  const repos: RepoForGame[] = records.map(toRepoForGame);
  const game_id = uuidv4();
  const secret = process.env.JWT_SECRET!;
  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    game_id,
    mode,
    game_date,
    repo_ids: records.map(r => r.id),
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7-day TTL
  };

  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

  res.json({ token, repos });
});

export default router;

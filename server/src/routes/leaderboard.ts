import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import leoProfanity from 'leo-profanity';
import {
  getDailyLeaderboard,
  getDailyAlltimeLeaderboard,
  getUnlimitedLeaderboard,
  insertLeaderboardEntry,
  getRepoStars,
  getDailyRank,
  getUnlimitedRank,
} from '../db';
import { computeRoundScore } from '../scoring';
import { SessionPayload } from '../types';

const router = Router();

const NICKNAME_RE = /^[a-zA-Z0-9 _-]{2,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REPEAT_CHAR_RE = /(.)\1{4,}/;

function validateNickname(nick: string): string | null {
  if (!NICKNAME_RE.test(nick)) return 'Nickname must be 2–20 characters: letters, digits, spaces, _ or -';
  if (REPEAT_CHAR_RE.test(nick)) return 'Nickname not allowed';
  if (leoProfanity.check(nick)) return 'Nickname not allowed';
  return null;
}

router.get('/daily', (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  if (!date || !DATE_RE.test(date) || isNaN(new Date(date).getTime())) {
    res.status(400).json({ error: 'date must be a valid YYYY-MM-DD' });
    return;
  }
  res.json(getDailyLeaderboard(date));
});

router.get('/daily/alltime', (_req: Request, res: Response) => {
  res.json(getDailyAlltimeLeaderboard());
});

router.get('/unlimited', (_req: Request, res: Response) => {
  res.json(getUnlimitedLeaderboard());
});

router.post('/', (req: Request, res: Response) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return;
  }

  const { token, nickname, mode, guesses, timestamps } = req.body as {
    token?: unknown;
    nickname?: unknown;
    mode?: unknown;
    guesses?: unknown;
    timestamps?: unknown;
  };

  if (typeof token !== 'string') {
    res.status(400).json({ error: 'token required' });
    return;
  }
  if (typeof nickname !== 'string') {
    res.status(400).json({ error: 'nickname required' });
    return;
  }
  if (typeof mode !== 'string' || (mode !== 'daily' && mode !== 'unlimited')) {
    res.status(400).json({ error: 'mode must be "daily" or "unlimited"' });
    return;
  }

  const nickError = validateNickname(nickname.trim());
  if (nickError) {
    res.status(400).json({ error: nickError });
    return;
  }

  if (!Array.isArray(guesses) || guesses.length !== 5) {
    res.status(400).json({ error: 'guesses must be array of 5 numbers' });
    return;
  }
  for (const g of guesses) {
    if (typeof g !== 'number' || !Number.isInteger(g) || g < 0) {
      res.status(400).json({ error: 'Each guess must be a non-negative integer' });
      return;
    }
  }

  if (!Array.isArray(timestamps) || timestamps.length !== 5) {
    res.status(400).json({ error: 'timestamps must be array of 5 numbers' });
    return;
  }
  for (const t of timestamps) {
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      res.status(400).json({ error: 'Each timestamp must be a number' });
      return;
    }
  }

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as SessionPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  if (payload.mode !== mode) {
    res.status(400).json({ error: 'Mode mismatch with session token' });
    return;
  }

  const submissionTime = Date.now() / 1000;
  if (submissionTime - payload.iat < 50) {
    res.status(400).json({ error: 'Submission too fast' });
    return;
  }

  const repoIds: number[] = payload.repo_ids;
  if (!Array.isArray(repoIds) || repoIds.length !== 5) {
    res.status(400).json({ error: 'Invalid session token data' });
    return;
  }

  const starsPerRepo: number[] = [];
  for (const id of repoIds) {
    const stars = getRepoStars(id);
    if (stars === null) {
      res.status(400).json({ error: 'Repo not found' });
      return;
    }
    starsPerRepo.push(stars);
  }

  const ROUND_DURATION_S = 90;
  let totalScore = 0;
  const roundStartTime = payload.iat;

  for (let i = 0; i < 5; i++) {
    const submitTs = timestamps[i] / 1000;
    const roundStart = roundStartTime + i * (ROUND_DURATION_S + 5);
    const elapsed = Math.max(0, Math.min(ROUND_DURATION_S, submitTs - roundStart));
    const secondsRemaining = ROUND_DURATION_S - elapsed;
    totalScore += computeRoundScore(guesses[i] as number, starsPerRepo[i], secondsRemaining);
  }

  totalScore = Math.min(totalScore, 6000);

  if (totalScore < 0 || totalScore > 6000 || !Number.isInteger(totalScore)) {
    res.status(400).json({ error: 'Invalid computed score' });
    return;
  }

  const game_date = mode === 'daily' ? (payload.game_date ?? null) : null;
  const id = insertLeaderboardEntry(nickname.trim(), totalScore, mode, game_date);

  const rank = mode === 'daily' && game_date
    ? getDailyRank(totalScore, game_date)
    : getUnlimitedRank(totalScore);

  res.json({ id, score: totalScore, rank });
});

export default router;

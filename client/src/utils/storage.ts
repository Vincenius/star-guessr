import { RoundResult, RepoForGame } from '../types';

export interface DailyResult {
  date: string;
  score: number;
  guesses: number[];
  repoIds: number[];
}

export interface PersonalBest {
  score: number;
  date: string;
}

// In-progress daily game state, saved after each submitted guess
export interface DailySession {
  date: string;
  token: string;
  repos: RepoForGame[];
  results: RoundResult[];  // completed rounds so far
  guesses: number[];
  sessionId: string;
}

export function getDailyResult(date: string): DailyResult | null {
  try {
    const raw = localStorage.getItem(`daily_played_${date}`);
    return raw ? (JSON.parse(raw) as DailyResult) : null;
  } catch {
    return null;
  }
}

export function setDailyResult(result: DailyResult): void {
  try {
    localStorage.setItem(`daily_played_${result.date}`, JSON.stringify(result));
  } catch {
    // storage unavailable
  }
}

export function getDailySession(date: string): DailySession | null {
  try {
    const raw = localStorage.getItem(`daily_session_${date}`);
    return raw ? (JSON.parse(raw) as DailySession) : null;
  } catch {
    return null;
  }
}

export function setDailySession(session: DailySession): void {
  try {
    localStorage.setItem(`daily_session_${session.date}`, JSON.stringify(session));
  } catch {
    // storage unavailable (quota exceeded etc.)
  }
}

export function clearDailySession(date: string): void {
  try {
    localStorage.removeItem(`daily_session_${date}`);
  } catch {
    // storage unavailable
  }
}

export function getFreeplayBest(): PersonalBest | null {
  try {
    const raw = localStorage.getItem('freeplay_best') ?? localStorage.getItem('unlimited_best');
    return raw ? (JSON.parse(raw) as PersonalBest) : null;
  } catch {
    return null;
  }
}

export function setFreeplayBest(score: number): void {
  try {
    const current = getFreeplayBest();
    if (!current || score > current.score) {
      const pb: PersonalBest = { score, date: new Date().toISOString() };
      localStorage.setItem('freeplay_best', JSON.stringify(pb));
    }
  } catch {
    // storage unavailable
  }
}

export function getRoundResults(sessionId: string): RoundResult[] {
  try {
    const raw = localStorage.getItem(`rounds_${sessionId}`);
    return raw ? (JSON.parse(raw) as RoundResult[]) : [];
  } catch {
    return [];
  }
}

export function saveRoundResult(sessionId: string, result: RoundResult): void {
  try {
    const results = getRoundResults(sessionId);
    results.push(result);
    localStorage.setItem(`rounds_${sessionId}`, JSON.stringify(results));
  } catch {
    // storage unavailable
  }
}

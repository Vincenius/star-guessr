import { RoundResult } from '../types';

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

export function getUnlimitedBest(): PersonalBest | null {
  try {
    const raw = localStorage.getItem('unlimited_best');
    return raw ? (JSON.parse(raw) as PersonalBest) : null;
  } catch {
    return null;
  }
}

export function setUnlimitedBest(score: number): void {
  try {
    const current = getUnlimitedBest();
    if (!current || score > current.score) {
      const pb: PersonalBest = { score, date: new Date().toISOString() };
      localStorage.setItem('unlimited_best', JSON.stringify(pb));
    }
  } catch {
    // storage unavailable
  }
}

export function getCheatFlag(sessionId: string): boolean {
  try {
    return localStorage.getItem(`cheat_${sessionId}`) === '1';
  } catch {
    return false;
  }
}

export function setCheatFlag(sessionId: string): void {
  try {
    localStorage.setItem(`cheat_${sessionId}`, '1');
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

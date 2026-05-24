export interface FileTreeNode {
  name: string;
  type: 'blob' | 'tree';
  path: string;
  sha?: string;
  children?: FileTreeNode[];
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface RepoForGame {
  id: number;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  created_at: string;
  topics: string[];
  license: string | null;
  file_tree: FileTreeNode[];
  commits: CommitInfo[];
  readme: string | null;
}

export interface SessionResponse {
  token: string;
  repos: RepoForGame[];
}

export interface LeaderboardEntry {
  id: number;
  nickname: string;
  score: number;
  mode: string;
  date: string;
  game_date: string | null;
}

export type GameMode = 'daily' | 'unlimited' | 'multiplayer';
export type GamePhase = 'playing' | 'reveal' | 'finished';

export interface RoundResult {
  repoId: number;
  repoName: string;
  owner: string;
  createdAt: string;
  guess: number;
  stars: number;
  score: number;
}

export interface MultiplayerPlayer {
  id: string;
  nickname: string;
  connected: boolean;
  isHost: boolean;
}

export interface MultiplayerReveal {
  playerId: string;
  nickname: string;
  guess: number | null;
  score: number;
  connected: boolean;
}

export interface MultiplayerRoundEnd {
  round: number;
  stars: number;
  reveals: MultiplayerReveal[];
}

export interface MultiplayerFinalScore {
  playerId: string;
  nickname: string;
  totalScore: number;
  roundScores: number[];
  roundGuesses: (number | null)[];
  connected: boolean;
}

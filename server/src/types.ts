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

export interface RepoRecord {
  id: number;
  name: string;
  owner: string;
  description: string | null;
  stars: number;
  language: string | null;
  created_at: string;
  topics: string; // JSON string
  license: string | null;
  default_branch: string;
  file_tree: string; // JSON string
  commits: string; // JSON string
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
}

export interface LeaderboardEntry {
  id: number;
  nickname: string;
  score: number;
  mode: string;
  date: string;
  game_date: string | null;
}

export interface SessionPayload {
  game_id: string;
  mode: 'daily' | 'unlimited';
  game_date?: string;
  repo_ids: number[];
  iat: number;
  exp: number;
}

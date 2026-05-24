import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RepoForGame, RoundResult, GamePhase } from '../types';
import { FileTree } from '../components/FileTree';
import { ReadmeViewer } from '../components/ReadmeViewer';
import { CommitsList } from '../components/CommitsList';
import { GuessInput } from '../components/GuessInput';
import { PostRound } from '../components/PostRound';
import { Scoreboard } from '../components/Scoreboard';
import { computeRoundScore } from '../utils/scoring';
import { useCheatDetector } from '../hooks/useCheatDetector';
import { todayUTC } from '../utils/scoring';
import {
  getDailyResult,
  setDailyResult,
  setUnlimitedBest,
  setCheatFlag,
} from '../utils/storage';

type MobileTab = 'files' | 'readme' | 'commits';
type ContentView = { type: 'readme' } | { type: 'file'; path: string; name: string };

interface GameState {
  phase: GamePhase;
  currentRound: number;
  repos: RepoForGame[];
  results: RoundResult[];
  token: string;
  sessionId: string;
  cheatFlag: boolean;
  timerKey: number;
}

async function fetchSession(mode: string, date?: string): Promise<{ token: string; repos: RepoForGame[] }> {
  const params = new URLSearchParams({ mode });
  if (date) params.set('date', date);
  const res = await fetch(`/api/session?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string };
    throw new Error(body.error || 'Failed to start session');
  }
  return res.json() as Promise<{ token: string; repos: RepoForGame[] }>;
}

async function fetchReadme(repoId: number): Promise<string> {
  const res = await fetch(`/api/repos/${repoId}/readme`);
  if (!res.ok) return '';
  const data = await res.json() as { content: string };
  return data.content;
}

async function fetchFileContent(repoId: number, filePath: string): Promise<string> {
  const res = await fetch(`/api/repos/${repoId}/file?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) return '[File content unavailable]';
  const data = await res.json() as { content: string };
  return data.content;
}

async function fetchStars(repoId: number): Promise<number> {
  const res = await fetch(`/api/repos/${repoId}/stars`);
  if (!res.ok) return 0;
  const data = await res.json() as { stars: number };
  return data.stars;
}

async function submitScore(
  token: string,
  nickname: string,
  mode: string,
  guesses: number[],
  timestamps: number[]
): Promise<{ rank: number; score: number }> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, nickname, mode, guesses, timestamps }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Failed to submit' })) as { error: string };
    throw new Error(body.error || 'Failed to submit score');
  }
  return res.json() as Promise<{ rank: number; score: number }>;
}

export function GamePage() {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const validMode = mode === 'daily' || mode === 'unlimited' ? mode : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('readme');
  const [contentView, setContentView] = useState<ContentView>({ type: 'readme' });
  const [readme, setReadme] = useState<string | null>(null);
  const [loadingReadme, setLoadingReadme] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const guessesRef = useRef<number[]>([]);
  const timestampsRef = useRef<number[]>([]);
  const sessionIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!validMode) {
      navigate('/');
      return;
    }

    if (validMode === 'daily') {
      const today = todayUTC();
      const existing = getDailyResult(today);
      if (existing) {
        navigate('/');
        return;
      }
    }

    fetchSession(validMode, validMode === 'daily' ? todayUTC() : undefined)
      .then(({ token, repos }) => {
        setGame({
          phase: 'playing',
          currentRound: 0,
          repos,
          results: [],
          token,
          sessionId: sessionIdRef.current,
          cheatFlag: false,
          timerKey: 0,
        });
        setLoading(false);
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : 'Failed to load game');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentRepo = game ? game.repos[game.currentRound] : null;

  useEffect(() => {
    if (!currentRepo) return;
    setReadme(null);
    setLoadingReadme(true);
    setContentView({ type: 'readme' });
    setFileContent(null);
    fetchReadme(currentRepo.id).then(content => {
      setReadme(content);
      setLoadingReadme(false);
    });
  }, [currentRepo?.id]);

  const handleCheat = useCallback(() => {
    if (!game) return;
    setCheatFlag(game.sessionId);
    setGame(g => g ? { ...g, cheatFlag: true } : g);
  }, [game]);

  useCheatDetector(game?.phase === 'playing', handleCheat);

  const handleFileSelect = useCallback(async (path: string, name: string) => {
    if (!currentRepo) return;
    setContentView({ type: 'file', path, name });
    setMobileTab('readme');
    setLoadingFile(true);
    setFileContent(null);
    const content = await fetchFileContent(currentRepo.id, path);
    setFileContent(content);
    setLoadingFile(false);
  }, [currentRepo]);

  const handleShowReadme = useCallback(() => {
    setContentView({ type: 'readme' });
    setFileContent(null);
  }, []);

  const handleGuessSubmit = useCallback(async (guess: number, secondsRemaining: number) => {
    if (!game || !currentRepo) return;

    guessesRef.current[game.currentRound] = guess;
    timestampsRef.current[game.currentRound] = Date.now();

    const stars = await fetchStars(currentRepo.id);
    const score = computeRoundScore(guess, stars, secondsRemaining);

    const result: RoundResult = {
      repoId: currentRepo.id,
      repoName: currentRepo.name,
      owner: currentRepo.owner,
      guess,
      stars,
      score,
      secondsRemaining,
    };

    setGame(g => g ? { ...g, phase: 'reveal', results: [...g.results, result] } : g);
  }, [game, currentRepo]);

  const handleNext = useCallback(() => {
    if (!game) return;
    const nextRound = game.currentRound + 1;
    if (nextRound >= game.repos.length) {
      setGame(g => g ? { ...g, phase: 'finished' } : g);
      const totalScore = [...game.results].reduce((s, r) => s + r.score, 0);
      if (validMode === 'daily') {
        setDailyResult({
          date: todayUTC(),
          score: totalScore,
          guesses: guessesRef.current,
          repoIds: game.repos.map(r => r.id),
        });
      } else if (validMode === 'unlimited') {
        setUnlimitedBest(totalScore);
      }
    } else {
      setGame(g =>
        g
          ? {
              ...g,
              phase: 'playing',
              currentRound: nextRound,
              timerKey: g.timerKey + 1,
            }
          : g
      );
    }
  }, [game, validMode]);

  const handleSubmitToLeaderboard = useCallback(
    async (nickname: string) => {
      if (!game || !validMode) throw new Error('No game state');
      return submitScore(game.token, nickname, validMode, guessesRef.current, timestampsRef.current);
    },
    [game, validMode]
  );

  if (!validMode) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-spin">⭐</div>
          <p className="text-gray-500">Loading repos…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-600 font-medium mb-2">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            Make sure to run the fetch script first to populate the database.
          </p>
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!game || !currentRepo) return null;

  if (game.phase === 'finished') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-700 text-sm">
              ← Home
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {validMode === 'daily' ? 'Daily Challenge' : 'Unlimited'} — Results
            </h1>
          </div>
          <Scoreboard
            results={game.results}
            mode={validMode}
            onSubmitToLeaderboard={!game.cheatFlag ? handleSubmitToLeaderboard : undefined}
            cheatFlag={game.cheatFlag}
            onPlayAgain={() => navigate('/')}
          />
        </div>
      </div>
    );
  }

  if (game.phase === 'reveal' && game.results.length > 0) {
    const lastResult = game.results[game.results.length - 1];
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-gray-500">
              Round {game.currentRound + 1} / {game.repos.length}
            </span>
            {game.cheatFlag && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Leaderboard submission disabled — tab switch detected.
              </span>
            )}
          </div>
          <PostRound
            result={lastResult}
            onNext={handleNext}
            isLast={game.currentRound >= game.repos.length - 1}
          />
        </div>
      </div>
    );
  }

  // Playing phase — three-panel layout
  const repoHeader = `${currentRepo.owner}/${currentRepo.name}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-700 text-sm">
          ← Home
        </button>
        <div className="flex-1 text-sm font-semibold text-gray-800 truncate">{repoHeader}</div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Round {game.currentRound + 1}/{game.repos.length}</span>
          <span className="text-blue-600 font-semibold">
            {game.results.reduce((s, r) => s + r.score, 0)} pts
          </span>
        </div>
        {game.cheatFlag && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hidden sm:block">
            Leaderboard disabled — tab switch detected
          </span>
        )}
      </div>

      {/* Mobile tabs */}
      <div className="sm:hidden flex border-b border-gray-200 bg-white shrink-0">
        {(['files', 'readme', 'commits'] as MobileTab[]).map(t => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 -mb-px ${
              mobileTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t === 'files' ? 'Files' : t === 'readme' ? 'README' : 'Commits'}
          </button>
        ))}
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: file tree (hidden on mobile unless tab active) */}
        <aside
          className={`${
            mobileTab === 'files' ? 'flex' : 'hidden'
          } sm:flex flex-col w-full sm:w-60 border-r border-gray-200 bg-white overflow-auto shrink-0 pb-36 sm:pb-0`}
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span>Files</span>
            {contentView.type === 'file' && (
              <button
                onClick={handleShowReadme}
                className="text-blue-600 hover:underline text-xs normal-case"
              >
                README
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto py-1">
            <FileTree
              nodes={currentRepo.file_tree}
              onFileSelect={handleFileSelect}
              selectedPath={contentView.type === 'file' ? contentView.path : null}
            />
          </div>
        </aside>

        {/* Center: README / file viewer */}
        <main
          className={`${
            mobileTab === 'readme' || mobileTab === 'files' ? 'flex' : 'hidden'
          } sm:flex flex-col flex-1 overflow-auto bg-white pb-36 sm:pb-0`}
        >
          {mobileTab === 'files' && <div className="sm:hidden" />}
          <div
            className={`${
              mobileTab === 'files' ? 'hidden sm:block' : 'block'
            } flex-1 overflow-auto`}
          >
            {loadingFile ? (
              <div className="p-6 text-sm text-gray-400 animate-pulse">Loading file…</div>
            ) : contentView.type === 'file' && fileContent !== null ? (
              <ReadmeViewer
                content={fileContent}
                filename={contentView.path}
                isCode={true}
              />
            ) : loadingReadme ? (
              <div className="p-6 text-sm text-gray-400 animate-pulse">Loading README…</div>
            ) : (
              <ReadmeViewer
                content={readme || '*No README available*'}
              />
            )}
          </div>
        </main>

        {/* Right: commits + guess input (desktop only has guess here) */}
        <aside
          className={`${
            mobileTab === 'commits' ? 'flex' : 'hidden'
          } sm:flex flex-col w-full sm:w-80 border-l border-gray-200 bg-white shrink-0`}
        >
          <div className="flex-1 overflow-auto border-b border-gray-200 pb-36 sm:pb-0">
            <CommitsList
              commits={currentRepo.commits}
              repoOwner={currentRepo.owner}
              repoName={currentRepo.name}
            />
          </div>
          <div className="hidden sm:block p-4 shrink-0">
            <GuessInput
              key={game.timerKey}
              timerKey={game.timerKey}
              onSubmit={handleGuessSubmit}
              disabled={game.phase !== 'playing'}
              round={game.currentRound}
              totalRounds={game.repos.length}
            />
          </div>
        </aside>

        {/* Mobile: always-visible sticky bottom bar with guess input */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-10">
          <GuessInput
            key={game.timerKey}
            timerKey={game.timerKey}
            onSubmit={handleGuessSubmit}
            disabled={game.phase !== 'playing'}
            round={game.currentRound}
            totalRounds={game.repos.length}
          />
        </div>
      </div>
    </div>
  );
}

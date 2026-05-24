import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RepoForGame, RoundResult, GamePhase } from '../types';
import { FileBrowser } from '../components/FileBrowser';
import { ReadmeViewer } from '../components/ReadmeViewer';
import { GuessInput } from '../components/GuessInput';
import { PostRound } from '../components/PostRound';
import { Scoreboard } from '../components/Scoreboard';
import { computeRoundScore } from '../utils/scoring';
import { todayUTC } from '../utils/scoring';
import {
  getDailyResult,
  setDailyResult,
  setUnlimitedBest,
  getDailySession,
  setDailySession,
  clearDailySession,
} from '../utils/storage';

type MobileTab = 'readme' | 'about';
type ContentView = { type: 'readme' } | { type: 'file'; path: string; name: string };

interface GameState {
  phase: GamePhase;
  currentRound: number;
  repos: RepoForGame[];
  results: RoundResult[];
  token: string;
  sessionId: string;
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
  guesses: number[]
): Promise<{ rank: number; score: number }> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, nickname, mode, guesses }),
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
  const sessionIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!validMode) {
      navigate('/');
      return;
    }

    if (validMode === 'daily') {
      const today = todayUTC();
      if (getDailyResult(today)) {
        navigate('/');
        return;
      }

      const saved = getDailySession(today);
      if (saved) {
        const completedRounds = saved.results.length;
        const totalRounds = saved.repos.length;
        guessesRef.current = saved.guesses;

        if (completedRounds >= totalRounds) {
          // All rounds done but game never reached "finished" (closed on last reveal).
          // Persist the result and show the scoreboard immediately.
          const totalScore = saved.results.reduce((s, r) => s + r.score, 0);
          setDailyResult({ date: today, score: totalScore, guesses: saved.guesses, repoIds: saved.repos.map(r => r.id) });
          clearDailySession(today);
          setGame({ phase: 'finished', currentRound: totalRounds - 1, repos: saved.repos, results: saved.results, token: saved.token, sessionId: saved.sessionId });
        } else {
          setGame({ phase: 'playing', currentRound: completedRounds, repos: saved.repos, results: saved.results, token: saved.token, sessionId: saved.sessionId });
        }
        setLoading(false);
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

  const handleGuessSubmit = useCallback(async (guess: number) => {
    if (!game || !currentRepo) return;

    guessesRef.current[game.currentRound] = guess;

    const stars = await fetchStars(currentRepo.id);
    const score = computeRoundScore(guess, stars);

    const result: RoundResult = {
      repoId: currentRepo.id,
      repoName: currentRepo.name,
      owner: currentRepo.owner,
      createdAt: currentRepo.created_at,
      guess,
      stars,
      score,
    };

    if (validMode === 'daily') {
      setDailySession({
        date: todayUTC(),
        token: game.token,
        repos: game.repos,
        results: [...game.results, result],
        guesses: guessesRef.current.slice(),
        sessionId: game.sessionId,
      });
    }

    setGame(g => g ? { ...g, phase: 'reveal', results: [...g.results, result] } : g);
  }, [game, currentRepo, validMode]);

  const handleNext = useCallback(() => {
    if (!game) return;
    const nextRound = game.currentRound + 1;
    if (nextRound >= game.repos.length) {
      setGame(g => g ? { ...g, phase: 'finished' } : g);
      const totalScore = [...game.results].reduce((s, r) => s + r.score, 0);
      if (validMode === 'daily') {
        clearDailySession(todayUTC());
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
        g ? { ...g, phase: 'playing', currentRound: nextRound } : g
      );
    }
  }, [game, validMode]);

  const handleSubmitToLeaderboard = useCallback(
    async (nickname: string) => {
      if (!game || !validMode) throw new Error('No game state');
      return submitScore(game.token, nickname, validMode, guessesRef.current);
    },
    [game, validMode]
  );

  if (!validMode) return null;

  if (loading) {
    return (
      <div className="grow bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-spin">⭐</div>
          <p className="text-gray-500">Loading repos…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grow bg-gray-50 flex items-center justify-center px-4">
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
      <div className="grow bg-gray-50 py-8">
        <div className="max-w-xl mx-auto px-4">
          <div className="relative flex items-center justify-center mb-6">
            <button onClick={() => navigate('/')} className="absolute left-0 text-gray-400 hover:text-gray-700 text-sm">
              ← Home
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {validMode === 'daily' ? 'Daily Challenge' : 'Unlimited'} — Results
            </h1>
          </div>
          <Scoreboard
            results={game.results}
            mode={validMode}
            date={validMode === 'daily' ? todayUTC() : undefined}
            onSubmitToLeaderboard={handleSubmitToLeaderboard}
            onPlayAgain={() => navigate('/')}
          />
        </div>
      </div>
    );
  }

  if (game.phase === 'reveal' && game.results.length > 0) {
    const lastResult = game.results[game.results.length - 1];
    return (
      <div className="grow bg-gray-50 py-8">
        <div className="max-w-xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-gray-500">
              Round {game.currentRound + 1} / {game.repos.length}
            </span>
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

  // Playing phase — GitHub-style layout (page-scroll so sticky works)
  const totalScore = game.results.reduce((s, r) => s + r.score, 0);

  const langColor: Record<string, string> = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    Rust: '#dea584', Go: '#00ADD8', Ruby: '#701516', Java: '#b07219',
    'C++': '#f34b7d', C: '#555555', Shell: '#89e051', HTML: '#e34c26',
    CSS: '#563d7c', Swift: '#F05138', Kotlin: '#A97BFF', 'C#': '#178600',
    PHP: '#4F5D95', Scala: '#c22d40', Dart: '#00B4AB', Elixir: '#6e4a7e',
    Haskell: '#5e5086', Lua: '#000080', 'Vim Script': '#199f4b',
  };

  const repoLang = currentRepo.language;
  const dotColor = repoLang ? (langColor[repoLang] ?? '#8c959f') : null;

  function fmtCreated(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch { return iso; }
  }

  return (
    <div className="grow bg-[#f6f8fa]">
      {/* GitHub dark nav */}
      <nav className="bg-[#24292f] z-20">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <button
            className="flex items-center gap-2 shrink-0 cursor-pointer"
            onClick={() => {
              if (game?.phase === 'playing') {
                if (confirm('Leave the current game? Your progress will be lost.')) navigate('/');
              } else {
                navigate('/');
              }
            }}
          >
            <span className="text-yellow-400 text-lg leading-none">★</span>
            <span className="text-white font-semibold text-sm hidden sm:block">StarGuessr</span>
          </button>
          <div className="h-5 w-px bg-[#57606a] hidden sm:block" />
          <span className="text-[#7d8590] text-sm capitalize hidden sm:block">{validMode}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#7d8590] tabular-nums">
              {game.currentRound + 1}<span className="text-[#57606a]">/{game.repos.length}</span>
            </span>
            <span className="bg-[#388bfd1a] text-[#58a6ff] border border-[#388bfd33] rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums">
              {totalScore} pts
            </span>
          </div>
        </div>
      </nav>

      {/* Repo header */}
      <div className="bg-white border-b border-[#d0d7de]">
        <div className="px-4 py-3 flex items-center gap-1.5 text-sm flex-wrap">
          <svg viewBox="0 0 16 16" width="16" height="16" className="fill-[#57606a] shrink-0" aria-hidden="true">
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
          </svg>
          <span className="text-[#0969da] font-semibold cursor-default">{currentRepo.owner}</span>
          <span className="text-[#57606a] text-lg font-light leading-none">/</span>
          <span className="text-[#0969da] font-semibold cursor-default">{currentRepo.name}</span>
          <span className="ml-0.5 text-xs border border-[#d0d7de] rounded-full px-2 py-0.5 text-[#656d76]">Public</span>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="sm:hidden flex border-b border-[#d0d7de] bg-white">
        {(['readme', 'about'] as MobileTab[]).map(t => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              mobileTab === t
                ? 'border-[#fd8c73] text-[#1f2328]'
                : 'border-transparent text-[#656d76]'
            }`}
          >
            {t === 'readme' ? 'README' : 'About'}
          </button>
        ))}
      </div>

      {/* Three-panel — page scrolls so sticky works */}
      <div className="sm:flex">
        {/* Left: guess input — sticks to viewport on scroll */}
        <aside className="hidden sm:block w-80 shrink-0 border-r border-[#d0d7de]">
          <div className="sticky top-0 p-4 bg-[#f6f8fa]">
            <GuessInput
              key={game.currentRound}
              onSubmit={handleGuessSubmit}
              disabled={game.phase !== 'playing'}
              round={game.currentRound}
              totalRounds={game.repos.length}
            />
          </div>
        </aside>

        {/* Center: file browser + README / file content */}
        <main className={`${mobileTab === 'readme' ? 'block' : 'hidden'} sm:block flex-1 min-w-0 bg-[#f6f8fa]`}>
          <div className="p-4 pb-36 sm:pb-4">
            {/* Compact file browser */}
            <FileBrowser
              key={game.currentRound}
              repoId={currentRepo.id}
              nodes={currentRepo.file_tree}
              onFileSelect={handleFileSelect}
              selectedPath={contentView.type === 'file' ? contentView.path : null}
              latestCommit={currentRepo.commits[0]}
            />

            {/* README / file viewer */}
            <div className="bg-white border border-[#d0d7de] rounded-md overflow-hidden">
              <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <svg viewBox="0 0 16 16" width="14" height="14" className="fill-[#57606a] shrink-0" aria-hidden="true">
                    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
                  </svg>
                  <span className="text-sm text-[#656d76] font-mono truncate">
                    {contentView.type === 'file' ? contentView.name : 'README.md'}
                  </span>
                </div>
                {contentView.type === 'file' && (
                  <button onClick={handleShowReadme} className="text-xs text-[#0969da] hover:underline shrink-0">
                    ← README
                  </button>
                )}
              </div>
              {loadingFile ? (
                <div className="p-6 text-sm text-[#656d76] animate-pulse">Loading file…</div>
              ) : contentView.type === 'file' && fileContent !== null ? (
                <ReadmeViewer content={fileContent} filename={contentView.path} />
              ) : loadingReadme ? (
                <div className="p-6 text-sm text-[#656d76] animate-pulse">Loading README…</div>
              ) : (
                <ReadmeViewer content={readme || '*No README available*'} />
              )}
            </div>
          </div>
        </main>

        {/* Right: About — sticks to viewport on scroll */}
        <aside className={`${mobileTab === 'about' ? 'block' : 'hidden'} sm:block w-full sm:w-64 shrink-0`}>
          <div className="sm:sticky sm:top-0 sm:h-screen sm:overflow-hidden sm:flex sm:flex-col border-l border-[#d0d7de]">

            {/* About */}
            <div className="p-4 border-b border-[#d0d7de] bg-[#f6f8fa] shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <svg viewBox="0 0 16 16" width="14" height="14" className="fill-[#57606a]" aria-hidden="true">
                  <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
                </svg>
                <span className="text-xs font-semibold text-[#1f2328]">About</span>
              </div>
              {currentRepo.description ? (
                <p className="text-sm text-[#1f2328] mb-3 leading-relaxed">{currentRepo.description}</p>
              ) : (
                <p className="text-sm text-[#656d76] italic mb-3">No description provided.</p>
              )}
              {currentRepo.topics.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {currentRepo.topics.map(t => (
                    <span key={t} className="text-xs bg-[#ddf4ff] text-[#0969da] border border-[#54aeff]/40 rounded-full px-2 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-1.5 text-xs text-[#656d76]">
                {dotColor && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                    {repoLang}
                  </div>
                )}
                {currentRepo.license && (
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 16" width="13" height="13" className="fill-[#57606a] shrink-0" aria-hidden="true">
                      <path d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.006.005-.01.01-.045.04c-.21.199-.52.451-.94.705-.862.525-2.066 1.029-3.77 1.029-1.703 0-2.907-.504-3.769-1.029a8.17 8.17 0 0 1-.94-.705l-.047-.041-.014-.012-.006-.006-.003-.002-.001-.002L7.022 9.5l-.53.53a.75.75 0 0 1-.154-.838L8.45 4.5H8A.75.75 0 0 1 8 3h.75V.75a.75.75 0 0 1 1.5 0Zm-.5 7.25L6.566 4.5h3.168L8.25 8Zm5.5-2.5H11.5l1.25 2.78Zm-8.75 0H2.75L4 8.28 4.75 5.5Zm5.56 6.44c1.232-.58 1.974-1.232 2.31-1.68H2.879c.337.448 1.08 1.1 2.311 1.68 1.008.475 2.135.77 2.81.77.675 0 1.802-.295 2.81-.77Z" />
                    </svg>
                    {currentRepo.license}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" width="13" height="13" className="fill-[#57606a] shrink-0" aria-hidden="true">
                    <path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0Zm0 3.5h-.75a.25.25 0 0 0-.25.25V6h9.5V3.75a.25.25 0 0 0-.25-.25h-.75V5a.75.75 0 0 1-1.5 0V3.5h-5V5a.75.75 0 0 1-1.5 0Zm-.75 4h8.5v6.75a.25.25 0 0 1-.25.25H2.75a.25.25 0 0 1-.25-.25V7.5Z" />
                  </svg>
                  Created {fmtCreated(currentRepo.created_at)}
                </div>
              </div>
            </div>

          </div>
        </aside>
      </div>

      {/* Mobile: sticky bottom guess bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#d0d7de] p-3 shadow-lg z-10">
        <GuessInput
          key={game.currentRound}
          onSubmit={handleGuessSubmit}
          disabled={game.phase !== 'playing'}
          round={game.currentRound}
          totalRounds={game.repos.length}
        />
      </div>
    </div>
  );
}

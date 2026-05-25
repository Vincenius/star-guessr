import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { RepoForGame, MultiplayerPlayer, MultiplayerRoundEnd, MultiplayerFinalScore } from '../types';
import { FileBrowser } from '../components/FileBrowser';
import { ReadmeViewer } from '../components/ReadmeViewer';
import { Timer } from '../components/Timer';
import { formatStars } from '../utils/scoring';

type Phase = 'lobby-entry' | 'lobby-waiting' | 'playing' | 'reveal' | 'countdown' | 'finished';
type MobileTab = 'readme' | 'about';

interface RoundReveal extends MultiplayerRoundEnd {}

const langColor: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Ruby: '#701516', Java: '#b07219',
  'C++': '#f34b7d', C: '#555555', Shell: '#89e051', HTML: '#e34c26',
  CSS: '#563d7c', Swift: '#F05138', Kotlin: '#A97BFF', 'C#': '#178600',
  PHP: '#4F5D95', Scala: '#c22d40', Dart: '#00B4AB', Elixir: '#6e4a7e',
  Haskell: '#5e5086', Lua: '#000080', 'Vim Script': '#199f4b',
};

function fmtCreated(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function getSocket(): Socket {
  return io({ path: '/socket.io', transports: ['websocket', 'polling'] });
}

export function MultiplayerPage() {
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const myRoomCodeRef = useRef('');
  const myPlayerIdRef = useRef('');

  const [phase, setPhase] = useState<Phase>('lobby-entry');
  const [entry, setEntry] = useState<'create' | 'join'>('create');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [myRoomCode, setMyRoomCode] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [currentRound, setCurrentRound] = useState(0);
  const [currentRepo, setCurrentRepo] = useState<RepoForGame | null>(null);
  const [guessValue, setGuessValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(90);

  const [roundReveal, setRoundReveal] = useState<RoundReveal | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [finalScores, setFinalScores] = useState<MultiplayerFinalScore[]>([]);

  const [mobileTab, setMobileTab] = useState<MobileTab>('readme');
  const [contentView, setContentView] = useState<{ type: 'readme' } | { type: 'file'; path: string; name: string }>({ type: 'readme' });
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [loadingReadme, setLoadingReadme] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  const submittedPlayersRef = useRef<Set<string>>(new Set());
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      if (myRoomCodeRef.current && myPlayerIdRef.current) {
        socket.emit('room:reconnect', { code: myRoomCodeRef.current, oldPlayerId: myPlayerIdRef.current });
      }
    });

    socket.on('room:created', (data: { code: string; playerId: string; player: MultiplayerPlayer }) => {
      setMyRoomCode(data.code);
      myRoomCodeRef.current = data.code;
      setMyPlayerId(data.playerId);
      myPlayerIdRef.current = data.playerId;
      setIsHost(true);
      setPlayers([data.player]);
      setPhase('lobby-waiting');
    });

    socket.on('room:joined', (data: { playerId: string; players: MultiplayerPlayer[]; code: string }) => {
      setMyPlayerId(data.playerId);
      myPlayerIdRef.current = data.playerId;
      setMyRoomCode(data.code);
      myRoomCodeRef.current = data.code;
      setPlayers(data.players);
      setPhase('lobby-waiting');
    });

    socket.on('room:player:joined', (data: { player: MultiplayerPlayer }) => {
      setPlayers(prev => [...prev.filter(p => p.id !== data.player.id), data.player]);
    });

    socket.on('room:updated', (data: { players: MultiplayerPlayer[]; phase: string; currentRound: number }) => {
      setPlayers(data.players);
    });

    socket.on('room:error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('game:start', () => {
      setPhase('playing');
    });

    socket.on('game:round:start', (data: { round: number; repo: RepoForGame; elapsed?: number }) => {
      setCurrentRound(data.round);
      setCurrentRepo(data.repo);
      setGuessValue('');
      setSubmitted(false);
      setPhase('playing');
      setTimerKey(k => k + 1);
      setContentView({ type: 'readme' });
      setFileContent(null);
      submittedPlayersRef.current = new Set();
      const elapsed = data.elapsed ?? 0;
      setSecondsLeft(Math.max(0, 90 - Math.floor(elapsed)));
    });

    socket.on('game:player:submitted', (data: { playerId: string; nickname: string }) => {
      submittedPlayersRef.current.add(data.playerId);
      setPlayers(prev =>
        prev.map(p => (p.id === data.playerId ? { ...p, _submitted: true } as MultiplayerPlayer : p))
      );
    });

    socket.on('game:round:end', (data: RoundReveal) => {
      setRoundReveal(data);
      setPhase('reveal');
      setCountdown(20);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    });

    socket.on('game:finished', (data: { scores: MultiplayerFinalScore[] }) => {
      setFinalScores(data.scores);
      setPhase('finished');
    });

    socket.on('player:disconnected', (data: { playerId: string; nickname: string }) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, connected: false } : p));
    });

    socket.on('player:reconnected', (data: { playerId: string }) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, connected: true } : p));
    });

    return () => {
      socket.disconnect();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentRepo) return;
    setReadme(null);
    setLoadingReadme(true);
    fetch(`/api/repos/${currentRepo.id}/readme`)
      .then(r => r.ok ? r.json() as Promise<{ content: string }> : Promise.resolve({ content: '' }))
      .then(d => { setReadme(d.content); setLoadingReadme(false); })
      .catch(() => { setReadme(''); setLoadingReadme(false); });
  }, [currentRepo?.id]);

  const handleCreate = () => {
    setError(null);
    socketRef.current?.emit('room:create', { nickname: nickname.trim() });
  };

  const handleJoin = () => {
    setError(null);
    socketRef.current?.emit('room:join', { code: roomCode.trim().toUpperCase(), nickname: nickname.trim() });
  };

  const handleStart = () => {
    socketRef.current?.emit('room:start', { code: myRoomCode });
  };

  const handleGuessSubmit = useCallback(() => {
    if (submitted || !currentRepo) return;
    const parsed = parseInt(guessValue, 10);
    const guess = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setSubmitted(true);
    socketRef.current?.emit('game:guess', { code: myRoomCode, guess });
  }, [submitted, currentRepo, guessValue, myRoomCode]);

  const handleFileSelect = async (path: string, name: string) => {
    if (!currentRepo) return;
    setContentView({ type: 'file', path, name });
    setMobileTab('readme');
    setLoadingFile(true);
    setFileContent(null);
    const res = await fetch(`/api/repos/${currentRepo.id}/file?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const data = await res.json() as { content: string };
      setFileContent(data.content);
    }
    setLoadingFile(false);
  };

  const handleShowReadme = () => {
    setContentView({ type: 'readme' });
    setFileContent(null);
  };

  // ── Lobby entry ──────────────────────────────────────────────────────────────
  if (phase === 'lobby-entry') {
    return (
      <div className="grow bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
          <div className="relative flex items-center justify-center mb-1">
            <button onClick={() => navigate('/')} className="absolute left-0 text-gray-400 hover:text-gray-700 text-sm">← Back</button>
            <h1 className="text-xl font-bold text-gray-900">Multiplayer</h1>
          </div>

          <div className="flex gap-2">
            {(['create', 'join'] as const).map(t => (
              <button
                key={t}
                onClick={() => setEntry(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  entry === t ? 'bg-[#2da44e] text-white border-[#2da44e]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'create' ? 'Create Room' : 'Join Room'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#656d76] mb-1">Nickname</label>
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Your nickname"
              className="w-full border border-[#d0d7de] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
            />
          </div>

          {entry === 'join' && (
            <div>
              <label className="block text-xs font-medium text-[#656d76] mb-1">Room Code</label>
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full border border-[#d0d7de] rounded-md px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={entry === 'create' ? handleCreate : handleJoin}
            disabled={nickname.trim().length < 2 || (entry === 'join' && roomCode.length !== 6)}
            className="w-full py-3 bg-[#2da44e] hover:bg-[#2c974b] text-white font-semibold rounded-lg disabled:opacity-40 transition-colors border border-[#1f883d] border-opacity-40"
          >
            {entry === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </div>
      </div>
    );
  }

  // ── Lobby waiting ─────────────────────────────────────────────────────────────
  if (phase === 'lobby-waiting') {
    return (
      <div className="grow bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-[#d0d7de] rounded-xl shadow-sm p-6 space-y-5">
          <div>
            <p className="text-xs text-[#656d76] mb-1">Room Code</p>
            <div className="text-3xl font-black font-mono text-[#1f2328] tracking-widest">{myRoomCode}</div>
            <p className="text-xs text-[#8c959f] mt-1">Share this with friends</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#656d76] uppercase tracking-wide">Players ({players.length})</p>
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-[#2da44e]' : 'bg-gray-300'}`} />
                <span className={p.id === myPlayerId ? 'font-semibold text-[#0969da]' : 'text-[#1f2328]'}>{p.nickname}</span>
                {p.isHost && <span className="text-xs text-[#8c959f]">(host)</span>}
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {isHost ? (
            <button
              onClick={handleStart}
              disabled={players.length < 2}
              className="w-full py-3 bg-[#2da44e] hover:bg-[#2c974b] text-white font-semibold rounded-lg disabled:opacity-40 transition-colors border border-[#1f883d] border-opacity-40"
            >
              {players.length < 2 ? 'Waiting for players…' : 'Start Game'}
            </button>
          ) : (
            <p className="text-sm text-center text-[#656d76] animate-pulse">Waiting for host to start…</p>
          )}
        </div>
      </div>
    );
  }

  // ── Round reveal ──────────────────────────────────────────────────────────────
  if (phase === 'reveal' && roundReveal) {
    const sorted = [...roundReveal.reveals].sort((a, b) => b.score - a.score);
    return (
      <div className="grow bg-[#f6f8fa] py-8 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#1f2328]">Round {roundReveal.round + 1} Results</h2>
            <span className="text-sm text-[#656d76]">Next round in {countdown}s…</span>
          </div>

          <div className="text-center py-4 bg-white border border-[#d0d7de] rounded-md">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1">
              <span className="text-amber-500">★</span>
              <span className="font-bold text-[#1f2328] text-lg tabular-nums">{formatStars(roundReveal.stars)}</span>
              <span className="text-[#656d76] text-sm">actual stars</span>
            </div>
          </div>

          <div className="bg-white border border-[#d0d7de] rounded-md overflow-hidden">
            <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#d0d7de]">
              <span className="text-xs font-semibold text-[#656d76] uppercase tracking-wide">Player Scores</span>
            </div>
            <div className="divide-y divide-[#d0d7de]">
              {sorted.map((r, i) => {
                const isFirst = i === 0;
                return (
                  <div
                    key={r.playerId}
                    className={`flex items-center gap-3 px-4 py-3 ${isFirst ? 'bg-amber-50' : ''}`}
                  >
                    <span className="text-sm text-[#656d76] w-5 shrink-0 tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${r.playerId === myPlayerId ? 'text-[#0969da]' : 'text-[#1f2328]'}`}>
                        {r.nickname}{r.playerId === myPlayerId ? ' (you)' : ''}
                      </p>
                      <p className="text-xs text-[#656d76]">
                        Guess: {r.guess !== null ? formatStars(r.guess) : '—'}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#0969da] tabular-nums">{r.score}</span>
                    {isFirst && <span className="text-amber-500 text-base">★</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Final scores ──────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const shareText = `StarGuessr Multiplayer — Room ${myRoomCode}\n` +
      finalScores.map((s, i) => `${i + 1}. ${s.nickname} — ${s.totalScore} pts`).join('\n');

    return (
      <div className="grow bg-[#f6f8fa] py-8 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="relative flex items-center justify-center mb-2">
            <button onClick={() => navigate('/')} className="absolute left-0 text-[#656d76] hover:text-[#1f2328] text-sm">
              ← Home
            </button>
            <h2 className="text-xl font-bold text-[#1f2328]">Final Scores</h2>
          </div>

          <div className="bg-white border border-[#d0d7de] rounded-md overflow-hidden">
            <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#d0d7de]">
              <span className="text-xs font-semibold text-[#656d76] uppercase tracking-wide">Leaderboard</span>
            </div>
            <div className="divide-y divide-[#d0d7de]">
              {finalScores.map((s, i) => (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? 'bg-amber-50' : ''}`}
                >
                  <span className="text-base w-6 shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-sm text-[#656d76] tabular-nums">#{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${s.playerId === myPlayerId ? 'text-[#0969da]' : 'text-[#1f2328]'}`}>
                      {s.nickname}{s.playerId === myPlayerId ? ' (you)' : ''}
                    </p>
                    <p className="text-xs text-[#656d76]">
                      {s.roundScores.map((rs, ri) => `R${ri + 1}: ${rs}`).join(' · ')}
                    </p>
                  </div>
                  <span className="text-lg font-black text-[#0969da] tabular-nums">{s.totalScore}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { void navigator.clipboard.writeText(shareText); }}
              className="flex-1 py-2.5 border border-[#d0d7de] text-sm font-medium rounded-md text-[#1f2328] hover:bg-[#f6f8fa] transition-colors"
            >
              Copy Result
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-2.5 bg-[#2da44e] hover:bg-[#2c974b] text-white text-sm font-semibold rounded-md transition-colors border border-[#1f883d] border-opacity-40"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting for first round ───────────────────────────────────────────────────
  if (!currentRepo) {
    return (
      <div className="grow bg-[#f6f8fa] flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-spin">⭐</div>
          <p className="text-[#656d76] animate-pulse">Waiting for round to start…</p>
        </div>
      </div>
    );
  }

  // ── Playing phase (GitHub-style layout) ───────────────────────────────────────
  const guessPreview = (() => {
    const p = parseInt(guessValue, 10);
    return !isNaN(p) && p > 0 ? formatStars(p) : null;
  })();

  const repoLang = currentRepo.language;
  const dotColor = repoLang ? (langColor[repoLang] ?? '#8c959f') : null;

  return (
    <div className="grow bg-[#f6f8fa]">
      {/* GitHub-style dark nav */}
      <nav className="bg-[#24292f] z-20">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <button
            className="flex items-center gap-2 shrink-0 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <span className="text-yellow-400 text-lg leading-none">★</span>
            <span className="text-white font-semibold text-sm hidden sm:block">StarGuessr</span>
          </button>
          <div className="h-5 w-px bg-[#57606a] hidden sm:block" />
          <span className="text-[#7d8590] text-sm hidden sm:block">Multiplayer</span>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#7d8590] tabular-nums">
              {currentRound + 1}<span className="text-[#57606a]">/5</span>
            </span>
            <span className="font-mono text-xs bg-[#388bfd1a] text-[#58a6ff] border border-[#388bfd33] rounded-full px-2.5 py-0.5 font-bold tracking-widest">
              {myRoomCode}
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

      {/* Three-panel layout — page scrolls so sticky works */}
      <div className="sm:flex">
        {/* Left: guess + timer — sticky */}
        <aside className="hidden sm:block w-80 shrink-0 border-r border-[#d0d7de]">
          <div className="sticky top-0 p-4 bg-[#f6f8fa]">
            <div className="bg-white border border-[#d0d7de] rounded-md overflow-hidden">
              <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 text-base">★</span>
                  <span className="text-sm font-semibold text-[#1f2328]">Your guess</span>
                </div>
                <span className="text-xs text-[#656d76] tabular-nums">Round {currentRound + 1} / 5</span>
              </div>
              <div className="p-4 space-y-4">
                <Timer
                  key={timerKey}
                  durationSeconds={secondsLeft}
                  running={!submitted}
                  onExpire={() => {
                    if (!submitted) {
                      setSubmitted(true);
                      socketRef.current?.emit('game:guess', { code: myRoomCode, guess: 0 });
                    }
                  }}
                />
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#656d76]">
                    How many GitHub stars does this repo have?
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={guessValue}
                      onChange={e => setGuessValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !submitted && handleGuessSubmit()}
                      disabled={submitted}
                      placeholder="e.g. 12500"
                      className="w-full border border-[#d0d7de] rounded-md px-3 py-2.5 text-base text-[#1f2328] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 disabled:bg-[#f6f8fa] disabled:text-[#656d76] font-mono placeholder:font-sans placeholder:text-[#8c959f]"
                    />
                    {guessPreview && !submitted && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8c959f] pointer-events-none">
                        ≈ {guessPreview}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleGuessSubmit}
                  disabled={submitted || guessValue === ''}
                  className="w-full py-2.5 bg-[#2da44e] hover:bg-[#2c974b] active:bg-[#298e46] text-white text-sm font-semibold rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 border border-[#1f883d] border-opacity-40"
                >
                  <span className="text-base leading-none">★</span>
                  <span>{submitted ? 'Submitted!' : 'Submit Guess'}</span>
                </button>
                {submitted && (
                  <p className="text-xs text-center text-[#656d76] animate-pulse">Waiting for reveal…</p>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Center: file browser + README */}
        <main className={`${mobileTab === 'readme' ? 'block' : 'hidden'} sm:block flex-1 min-w-0 bg-[#f6f8fa]`}>
          <div className="p-4 pb-36 sm:pb-4">
            <FileBrowser
              key={currentRound}
              repoId={currentRepo.id}
              nodes={currentRepo.file_tree}
              onFileSelect={handleFileSelect}
              selectedPath={contentView.type === 'file' ? contentView.path : null}
              latestCommit={currentRepo.commits[0]}
            />

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

        {/* Right: About + Players — sticky */}
        <aside className={`${mobileTab === 'about' ? 'block' : 'hidden'} sm:block w-full sm:w-64 shrink-0`}>
          <div className="sm:sticky sm:top-0 sm:h-screen sm:overflow-y-auto border-l border-[#d0d7de]">

            {/* About */}
            <div className="p-4 border-b border-[#d0d7de] bg-[#f6f8fa]">
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

            {/* Players */}
            <div className="p-4 bg-[#f6f8fa]">
              <p className="text-xs font-semibold text-[#656d76] uppercase tracking-wide mb-2">Players</p>
              <div className="space-y-1.5">
                {players.map(p => {
                  const hasSubmitted = submittedPlayersRef.current.has(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.connected ? 'bg-[#2da44e]' : 'bg-[#d0d7de]'}`} />
                      <span className={`flex-1 truncate ${p.id === myPlayerId ? 'font-semibold text-[#0969da]' : 'text-[#1f2328]'}`}>
                        {p.nickname}
                      </span>
                      {hasSubmitted && <span className="text-[#2da44e] font-bold">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </aside>
      </div>

      {/* Mobile: sticky bottom guess bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#d0d7de] p-3 shadow-lg z-10 space-y-2">
        <Timer
          key={timerKey}
          durationSeconds={secondsLeft}
          running={!submitted}
          onExpire={() => {
            if (!submitted) {
              setSubmitted(true);
              socketRef.current?.emit('game:guess', { code: myRoomCode, guess: 0 });
            }
          }}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              value={guessValue}
              onChange={e => setGuessValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !submitted && handleGuessSubmit()}
              disabled={submitted}
              placeholder="e.g. 12500"
              className="w-full border border-[#d0d7de] rounded-md px-3 py-2.5 text-base text-[#1f2328] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 disabled:bg-[#f6f8fa] disabled:text-[#656d76] font-mono placeholder:font-sans placeholder:text-[#8c959f]"
            />
            {guessPreview && !submitted && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8c959f] pointer-events-none">
                ≈ {guessPreview}
              </span>
            )}
          </div>
          <button
            onClick={handleGuessSubmit}
            disabled={submitted || guessValue === ''}
            className="px-4 py-2.5 bg-[#2da44e] hover:bg-[#2c974b] text-white text-sm font-semibold rounded-md disabled:opacity-40 transition-colors border border-[#1f883d] border-opacity-40"
          >
            {submitted ? '✓' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

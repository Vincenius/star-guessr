import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyResult, getFreeplayBest } from '../utils/storage';
import { todayUTC } from '../utils/scoring';

function ScoreBar({ score, max = 5000 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Score</span>
        <span className="text-sm font-bold text-gray-800">
          {score.toLocaleString()} <span className="text-gray-400 font-normal">/ {max.toLocaleString()}</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function msUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export function HomePage() {
  const navigate = useNavigate();
  const today = todayUTC();
  const dailyResult = getDailyResult(today);
  const freeplayBest = getFreeplayBest();
  const [countdown, setCountdown] = React.useState(msUntilMidnightUTC());

  React.useEffect(() => {
    const iv = setInterval(() => setCountdown(msUntilMidnightUTC()), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="grow bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10">

        <div className="text-center mb-10">
          <div className="text-5xl mb-3">⭐</div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">StarGuessr</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Guess the GitHub star count of 5 repositories
          </p>
        </div>

        <div className="space-y-3">

          {/* Daily Challenge */}
          <button
            onClick={() => navigate('/game/daily')}
            disabled={!!dailyResult}
            className={`w-full text-left rounded-2xl p-5 border transition-all ${dailyResult
                ? 'bg-white border-gray-200 cursor-default opacity-80'
                : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300'
              }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Daily Challenge</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {dailyResult ? `Next daily in ${formatCountdown(countdown)}` : '5 repos · one attempt per day'}
                </p>
              </div>
              {dailyResult ? (
                <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-semibold shrink-0 ml-3">
                  Done ✓
                </span>
              ) : (
                <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-semibold shrink-0 ml-3">
                  Daily
                </span>
              )}
            </div>
            {dailyResult && <ScoreBar score={dailyResult.score} />}
          </button>

          {/* Freeplay */}
          <button
            onClick={() => navigate('/game/freeplay')}
            className="w-full text-left bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Freeplay</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {freeplayBest ? 'Keep beating your best score' : 'Random repos · unlimited plays'}
                </p>
              </div>
            </div>
            {freeplayBest && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Personal best</span>
                  <span className="text-sm font-bold text-gray-800">
                    {freeplayBest.score.toLocaleString()} <span className="text-gray-400 font-normal">/ 5,000</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (freeplayBest.score / 5000) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </button>

          {/* Multiplayer */}
          <button
            onClick={() => navigate('/multiplayer')}
            className="w-full text-left bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Multiplayer</h2>
                <p className="text-sm text-gray-500 mt-0.5">Play with friends in real-time</p>
              </div>
            </div>
          </button>

        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => navigate('/leaderboard')}
            className="text-sm text-gray-400 hover:text-blue-500 transition-colors"
          >
            View Leaderboard →
          </button>
        </div>

      </div>
    </div>
  );
}

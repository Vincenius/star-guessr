import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyResult, getUnlimitedBest } from '../utils/storage';
import { todayUTC } from '../utils/scoring';

function ModeCard({
  title,
  description,
  badge,
  onClick,
  disabled,
  disabledReason,
}: {
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {badge && (
          <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600">{description}</p>
      {disabled && disabledReason && (
        <p className="text-xs text-amber-600 mt-2">{disabledReason}</p>
      )}
    </button>
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
  const unlimitedBest = getUnlimitedBest();
  const [countdown, setCountdown] = React.useState(msUntilMidnightUTC());

  React.useEffect(() => {
    if (!dailyResult) return;
    const iv = setInterval(() => setCountdown(msUntilMidnightUTC()), 1000);
    return () => clearInterval(iv);
  }, [dailyResult]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⭐</div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">StarGuessr</h1>
          <p className="text-gray-500 mt-2 text-base">
            Browse real GitHub repos. Guess their star count.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Star counts are updated periodically and may not reflect current GitHub data.
          </p>
        </div>

        <div className="space-y-4">
          <ModeCard
            title="Daily Challenge"
            description="5 curated repos, same for everyone today. One attempt per day."
            badge="Daily"
            onClick={() => navigate('/game/daily')}
            disabled={!!dailyResult}
            disabledReason={
              dailyResult
                ? `Already played today! Score: ${dailyResult.score}. Next daily in ${formatCountdown(countdown)}.`
                : undefined
            }
          />

          {dailyResult && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
              <p className="font-medium text-gray-700 mb-1">Today's result</p>
              <p className="text-gray-600">
                Score: <span className="font-bold text-blue-600">{dailyResult.score}</span> / 6,000
              </p>
              <p className="text-xs text-gray-400 mt-1">Next daily in {formatCountdown(countdown)}</p>
            </div>
          )}

          <ModeCard
            title="Unlimited"
            description="Random repos, unlimited plays. Compete on the all-time leaderboard."
            badge="∞"
            onClick={() => navigate('/game/unlimited')}
          />

          {unlimitedBest && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
              <p className="font-medium text-gray-700 mb-1">Your best score</p>
              <p className="text-gray-600">
                <span className="font-bold text-blue-600">{unlimitedBest.score}</span> / 6,000
              </p>
            </div>
          )}

          <ModeCard
            title="Multiplayer"
            description="Play with friends in real-time. Create or join a room."
            badge="Live"
            onClick={() => navigate('/multiplayer')}
          />
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate('/leaderboard')}
            className="text-sm text-blue-600 hover:underline"
          >
            View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}

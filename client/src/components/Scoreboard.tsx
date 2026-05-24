import { useState } from 'react';
import { RoundResult } from '../types';
import { formatStars } from '../utils/scoring';

interface Props {
  results: RoundResult[];
  mode: 'daily' | 'unlimited';
  onSubmitToLeaderboard?: (nickname: string) => Promise<{ rank: number; score: number }>;
  cheatFlag: boolean;
  onPlayAgain: () => void;
}

export function Scoreboard({ results, mode, onSubmitToLeaderboard, cheatFlag, onPlayAgain }: Props) {
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ rank: number; score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalScore = results.reduce((s, r) => s + r.score, 0);

  const handleSubmit = async () => {
    if (!onSubmitToLeaderboard || submitted || cheatFlag) return;
    const nick = nickname.trim();
    if (nick.length < 2) {
      setError('Nickname must be at least 2 characters');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await onSubmitToLeaderboard(nick);
      setSubmitResult(res);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const shareText = `StarGuessr ${mode === 'daily' ? 'Daily' : 'Unlimited'} — ${totalScore} pts\n` +
    results.map((r, i) => `Round ${i + 1}: ${formatStars(r.guess)} → ${formatStars(r.stars)} (${r.score}pts)`).join('\n');

  return (
    <div className="max-w-xl mx-auto p-5 space-y-5">
      <div className="text-center">
        <div className="text-4xl font-black text-blue-600 tabular-nums">{totalScore}</div>
        <div className="text-gray-500 text-sm mt-1">out of 6,000 pts</div>
        {submitResult && (
          <div className="mt-2 text-sm font-medium text-green-700">
            Rank #{submitResult.rank} on the leaderboard!
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {results.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50">
            <span className="text-xs text-gray-400 w-6 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {r.owner}/{r.repoName}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Guess: {formatStars(r.guess)} · Actual: {formatStars(r.stars)}
              </div>
            </div>
            <span className="text-sm font-bold text-blue-600 tabular-nums shrink-0">{r.score}</span>
          </div>
        ))}
      </div>

      {cheatFlag && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800">
          Leaderboard submission disabled — tab switch detected.
        </div>
      )}

      {!cheatFlag && !submitted && onSubmitToLeaderboard && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Submit to leaderboard</p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Your nickname"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || nickname.trim().length < 2}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? '…' : 'Submit'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            void navigator.clipboard.writeText(shareText);
          }}
          className="flex-1 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Copy Result
        </button>
        <button
          onClick={onPlayAgain}
          className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

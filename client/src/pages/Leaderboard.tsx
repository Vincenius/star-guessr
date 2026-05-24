import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaderboardEntry } from '../types';
import { todayUTC } from '../utils/scoring';

type Tab = 'daily-today' | 'daily-alltime' | 'unlimited';

async function fetchLeaderboard(tab: Tab): Promise<LeaderboardEntry[]> {
  let url: string;
  if (tab === 'daily-today') url = `/api/leaderboard/daily?date=${todayUTC()}`;
  else if (tab === 'daily-alltime') url = '/api/leaderboard/daily/alltime';
  else url = '/api/leaderboard/unlimited';

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load leaderboard');
  return res.json() as Promise<LeaderboardEntry[]>;
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span title="1st">🥇</span>;
  if (rank === 2) return <span title="2nd">🥈</span>;
  if (rank === 3) return <span title="3rd">🥉</span>;
  return <span className="text-gray-400 text-sm font-mono">#{rank}</span>;
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('daily-today');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLeaderboard(tab)
      .then(setEntries)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'daily-today', label: 'Today' },
    { id: 'daily-alltime', label: 'All-time Daily' },
    { id: 'unlimited', label: 'Unlimited' },
  ];

  return (
    <div className="grow bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-700 text-sm">
            ← Back
          </button>
          <h1 className="text-2xl font-black text-gray-900">Leaderboard</h1>
        </div>

        <div className="flex gap-2 mb-5 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-400 animate-pulse">Loading…</div>
        )}
        {error && (
          <div className="text-center py-12 text-red-500">{error}</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-12 text-gray-400">No entries yet. Be the first!</div>
        )}
        {!loading && !error && entries.length > 0 && (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
            {entries.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-8 text-center shrink-0">
                  <Medal rank={i + 1} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.nickname}</p>
                  {entry.game_date && (
                    <p className="text-xs text-gray-400">{entry.game_date}</p>
                  )}
                </div>
                <span className="text-base font-bold text-blue-600 tabular-nums shrink-0">
                  {entry.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

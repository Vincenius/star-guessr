import { RoundResult } from '../types';
import { formatStars } from '../utils/scoring';

interface Props {
  result: RoundResult;
  onNext: () => void;
  isLast: boolean;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 1000) * 100);
  const color = score >= 900 ? 'bg-green-500' : score >= 600 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ratio(guess: number, actual: number): string {
  if (actual === 0) return '—';
  const r = guess / actual;
  if (r > 1) return `${r.toFixed(1)}× too high`;
  if (r < 1) return `${(1 / r).toFixed(1)}× too low`;
  return 'Exact!';
}

export function PostRound({ result, onNext, isLast }: Props) {
  return (
    <div className="flex flex-col gap-4 p-5 max-w-xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1 mb-3">
          <span className="text-amber-500">★</span>
          <span className="font-bold text-gray-800 text-lg tabular-nums">
            {formatStars(result.stars)}
          </span>
          <span className="text-gray-500 text-sm">actual stars</span>
        </div>

        <div className="text-sm text-gray-600">
          Your guess: <span className="font-semibold text-gray-800">{formatStars(result.guess)}</span>
          {' '}·{' '}
          <span className="text-gray-500">{ratio(result.guess, result.stars)}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Round score</span>
          <span className="text-2xl font-bold text-blue-600 tabular-nums">{result.score}</span>
        </div>
        <ScoreBar score={result.score} />
        <p className="text-xs text-gray-400">Max 1,000 pts per round</p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-2">
        <div className="font-semibold text-gray-700 text-base flex items-center gap-2">
          <a
            href={`https://github.com/${result.owner}/${result.repoName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0969da] hover:underline"
          >
            {result.owner}/{result.repoName}
          </a>
          <svg viewBox="0 0 16 16" width="13" height="13" className="fill-[#57606a] shrink-0" aria-hidden="true">
            <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">★ {formatStars(result.stars)} stars</span>
          <span className="text-gray-300">|</span>
          <span>Created {new Date(result.createdAt).toLocaleDateString()}</span>
        </div>
        <p className="text-xs text-gray-400 italic mt-1">
          Star counts are updated periodically and may not reflect current GitHub data.
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        {isLast ? 'See Final Results' : 'Next Round →'}
      </button>
    </div>
  );
}

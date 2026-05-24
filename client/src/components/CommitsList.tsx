import { CommitInfo } from '../types';

interface Props {
  commits: CommitInfo[];
  repoOwner: string;
  repoName: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function CommitsList({ commits, repoOwner, repoName }: Props) {
  if (!commits || commits.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-400 italic">No commits available</div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
        {repoOwner}/{repoName} — Recent commits
      </div>
      {commits.map((commit, i) => (
        <div key={i} className="px-3 py-2 hover:bg-gray-50">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-gray-800 leading-snug line-clamp-2 flex-1">
              {commit.message.split('\n')[0]}
            </p>
            <span className="font-mono text-xs text-gray-400 shrink-0 mt-0.5">{commit.sha}</span>
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {commit.author} · {formatDate(commit.date)}
          </div>
        </div>
      ))}
    </div>
  );
}

import { CommitInfo } from '../types';

interface Props {
  commits: CommitInfo[];
  repoOwner: string;
  repoName: string;
}

function formatRelativeDate(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  } catch {
    return iso;
  }
}

export function CommitsList({ commits }: Props) {
  if (!commits || commits.length === 0) {
    return (
      <div className="p-4 text-sm text-[#656d76] italic">No commits available</div>
    );
  }

  return (
    <div>
      <div className="px-4 py-2.5 text-xs font-semibold text-[#656d76] uppercase tracking-wide bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center gap-1.5">
        <svg viewBox="0 0 16 16" width="14" height="14" className="fill-[#57606a]" aria-hidden="true">
          <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
        </svg>
        Commits
      </div>
      <div className="divide-y divide-[#d0d7de]">
        {commits.map((commit, i) => (
          <div key={i} className="px-4 py-3 hover:bg-[#f6f8fa] transition-colors">
            <p className="text-sm text-[#1f2328] leading-snug line-clamp-2 mb-1.5">
              {commit.message.split('\n')[0]}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#656d76] truncate">
                {commit.author} · {formatRelativeDate(commit.date)}
              </span>
              <span className="font-mono text-xs text-[#0969da] bg-[#ddf4ff] border border-[#54aeff] border-opacity-40 rounded px-1.5 py-0.5 shrink-0">
                {commit.sha}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

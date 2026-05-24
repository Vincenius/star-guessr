import { useState } from 'react';
import { CommitInfo, FileTreeNode } from '../types';

interface Props {
  nodes: FileTreeNode[];
  onFileSelect: (path: string, name: string) => void;
  selectedPath: string | null;
  latestCommit?: CommitInfo;
}

function formatRelativeDate(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  } catch {
    return iso;
  }
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className="fill-[#54aeff] shrink-0" aria-hidden="true">
      <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className="fill-[#57606a] shrink-0" aria-hidden="true">
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" className="fill-[#8c959f] shrink-0 ml-auto" aria-hidden="true">
      <path d="M4.7 10c-.2 0-.4-.1-.5-.2-.3-.3-.3-.8 0-1.1L6.9 6 4.2 3.3c-.3-.3-.3-.8 0-1.1.3-.3.8-.3 1.1 0l3.3 3.2c.3.3.3.8 0 1.1L5.3 9.8c-.2.1-.4.2-.6.2Z" />
    </svg>
  );
}

const ROW_CAP = 12;

function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function FileBrowser({ nodes, onFileSelect, selectedPath, latestCommit }: Props) {
  const [navStack, setNavStack] = useState<{ name: string; nodes: FileTreeNode[] }[]>([]);
  const [showAll, setShowAll] = useState(false);

  const currentNodes = navStack.length > 0 ? navStack[navStack.length - 1].nodes : nodes;
  const sorted = sortNodes(currentNodes);
  const visible = showAll ? sorted : sorted.slice(0, ROW_CAP);
  const hiddenCount = sorted.length - ROW_CAP;

  const enterFolder = (node: FileTreeNode) => {
    if (node.type === 'tree' && node.children?.length) {
      setNavStack(s => [...s, { name: node.name, nodes: node.children! }]);
      setShowAll(false);
    }
  };

  const goBack = () => {
    setNavStack(s => s.slice(0, -1));
    setShowAll(false);
  };

  return (
    <div className="bg-white border border-[#d0d7de] rounded-md overflow-hidden mb-4">
      {/* Breadcrumb header */}
      <div className="px-4 py-2 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center gap-2 min-h-[2.25rem]">
        {navStack.length === 0 ? (
          <>
            <span className="text-xs font-medium text-[#656d76] shrink-0">Files</span>
            {latestCommit && (
              <div className="flex items-center gap-1.5 min-w-0 ml-auto">
                <svg viewBox="0 0 16 16" width="12" height="12" className="fill-[#57606a] shrink-0" aria-hidden="true">
                  <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
                </svg>
                <span className="text-xs text-[#656d76] truncate max-w-[160px]">
                  {latestCommit.message.split('\n')[0]}
                </span>
                <span className="font-mono text-xs text-[#0969da] bg-[#ddf4ff] border border-[#54aeff]/40 rounded px-1.5 py-0.5 shrink-0">
                  {latestCommit.sha}
                </span>
                <span className="text-xs text-[#656d76] shrink-0 whitespace-nowrap hidden sm:block">
                  {formatRelativeDate(latestCommit.date)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1 text-xs flex-wrap">
            <button onClick={() => { setNavStack([]); setShowAll(false); }} className="text-[#0969da] hover:underline">
              /
            </button>
            {navStack.map((entry, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-[#57606a]">/</span>
                {i === navStack.length - 1 ? (
                  <span className="font-semibold text-[#1f2328]">{entry.name}</span>
                ) : (
                  <button
                    onClick={() => { setNavStack(s => s.slice(0, i + 1)); setShowAll(false); }}
                    className="text-[#0969da] hover:underline"
                  >
                    {entry.name}
                  </button>
                )}
              </span>
            ))}
            <button onClick={goBack} className="ml-2 text-[#656d76] hover:text-[#1f2328]">← back</button>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#d0d7de]">
        {visible.map(node => {
          const isSelected = selectedPath === node.path;
          const isFolder = node.type === 'tree';
          return (
            <button
              key={node.path}
              onClick={() => isFolder ? enterFolder(node) : onFileSelect(node.path, node.name)}
              className={`flex items-center gap-2.5 w-full px-4 py-1.5 text-sm text-left transition-colors ${
                isSelected
                  ? 'bg-[#ddf4ff]'
                  : 'hover:bg-[#f6f8fa]'
              }`}
            >
              {isFolder ? <FolderIcon /> : <FileIcon />}
              <span className={`truncate ${isSelected ? 'text-[#0969da]' : 'text-[#1f2328]'}`}>
                {node.name}
              </span>
              {isFolder && <ChevronIcon />}
            </button>
          );
        })}
      </div>

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full px-4 py-2 text-xs text-[#0969da] hover:bg-[#f6f8fa] border-t border-[#d0d7de] text-left transition-colors"
        >
          Show {hiddenCount} more…
        </button>
      )}
    </div>
  );
}

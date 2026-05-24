import { useState } from 'react';
import { FileTreeNode } from '../types';

interface Props {
  nodes: FileTreeNode[];
  onFileSelect: (path: string, name: string) => void;
  selectedPath: string | null;
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" className="fill-[#54aeff] shrink-0" aria-hidden="true">
        <path d="M.513 1.513A1.75 1.75 0 0 1 1.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 0 0 .2.1H13.5A1.75 1.75 0 0 1 15.25 4.75v.055a2.5 2.5 0 0 1 .75 1.807V13A1.75 1.75 0 0 1 14.25 14.75H1.75A1.75 1.75 0 0 1 0 13V2.75c0-.464.184-.91.513-1.237Z" />
      </svg>
    );
  }
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      className={`fill-[#57606a] shrink-0 transition-transform duration-100 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M4.7 10c-.2 0-.4-.1-.5-.2-.3-.3-.3-.8 0-1.1L6.9 6 4.2 3.3c-.3-.3-.3-.8 0-1.1.3-.3.8-.3 1.1 0l3.3 3.2c.3.3.3.8 0 1.1L5.3 9.8c-.2.1-.4.2-.6.2Z" />
    </svg>
  );
}

function TreeNode({
  node,
  depth,
  onFileSelect,
  selectedPath,
}: {
  node: FileTreeNode;
  depth: number;
  onFileSelect: (path: string, name: string) => void;
  selectedPath: string | null;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = selectedPath === node.path;

  if (node.type === 'tree') {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 w-full text-left py-0.5 rounded hover:bg-[#f6f8fa] text-sm text-[#1f2328]"
          style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: '8px' }}
        >
          <ChevronIcon open={open} />
          <FolderIcon open={open} />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map(child => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(node.path, node.name)}
      className={`flex items-center gap-1.5 w-full text-left py-0.5 rounded text-sm truncate transition-colors ${
        isSelected
          ? 'bg-[#ddf4ff] text-[#0969da]'
          : 'hover:bg-[#f6f8fa] text-[#1f2328]'
      }`}
      style={{ paddingLeft: `${depth * 14 + 8 + 12}px`, paddingRight: '8px' }}
    >
      <FileIcon />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({ nodes, onFileSelect, selectedPath }: Props) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-[#656d76] italic">No file tree available</div>
    );
  }

  return (
    <div className="text-xs py-1">
      {nodes.map(node => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}

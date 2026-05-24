import { useState } from 'react';
import { FileTreeNode } from '../types';

interface Props {
  nodes: FileTreeNode[];
  onFileSelect: (path: string, name: string) => void;
  selectedPath: string | null;
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
          className="flex items-center gap-1 w-full text-left px-2 py-0.5 rounded hover:bg-gray-100 text-sm text-gray-700"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-gray-400 text-xs w-3 shrink-0">{open ? '▾' : '▸'}</span>
          <span className="text-yellow-600 mr-1">📁</span>
          <span className="font-medium truncate">{node.name}</span>
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
      className={`flex items-center gap-1 w-full text-left px-2 py-0.5 rounded text-sm truncate ${
        isSelected ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-3 shrink-0" />
      <span className="text-gray-400 mr-1">📄</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({ nodes, onFileSelect, selectedPath }: Props) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 italic">No file tree available</div>
    );
  }

  return (
    <div className="font-mono text-xs overflow-auto">
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

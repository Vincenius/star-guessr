import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface Props {
  content: string;
  filename?: string;
  isCode?: boolean;
}

export function ReadmeViewer({ content, filename, isCode }: Props) {
  if (!content) {
    return (
      <div className="p-6 text-sm text-gray-400 italic">No content available</div>
    );
  }

  if (isCode) {
    return (
      <div className="p-4">
        {filename && (
          <div className="text-xs text-gray-500 mb-2 font-mono border-b border-gray-200 pb-2">
            {filename}
          </div>
        )}
        <pre className="text-xs font-mono text-gray-800 overflow-auto whitespace-pre-wrap break-words">
          <code>{content}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-auto">
      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:bg-gray-100 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-100 prose-img:rounded prose-table:text-sm">
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

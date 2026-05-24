import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface Props {
  content: string;
  filename?: string;
}

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', kt: 'kotlin', scala: 'scala',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', cs: 'csharp',
  php: 'php', swift: 'swift', dart: 'dart',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  xml: 'xml', sql: 'sql', graphql: 'graphql',
  dockerfile: 'dockerfile', makefile: 'makefile',
  r: 'r', lua: 'lua', ex: 'elixir', exs: 'elixir',
  hs: 'haskell', clj: 'clojure', elm: 'elm',
};

function detectLang(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  const base = lower.split('/').pop() ?? lower;
  if (base === 'dockerfile' || base === 'makefile') return base;
  const ext = base.split('.').pop();
  return ext ? EXT_TO_LANG[ext] : undefined;
}

function isMarkdown(filename: string): boolean {
  return /\.(md|mdx|markdown)$/i.test(filename);
}

export function ReadmeViewer({ content, filename }: Props) {
  if (!content) {
    return (
      <div className="p-6 text-sm text-gray-400 italic">No content available</div>
    );
  }

  if (filename && !isMarkdown(filename)) {
    const lang = detectLang(filename);
    return (
      <div className="overflow-auto">
        {filename && (
          <div className="text-xs text-[#656d76] px-4 py-1.5 font-mono border-b border-[#d0d7de] bg-[#f6f8fa]">
            {filename}
          </div>
        )}
        <SyntaxHighlighter
          language={lang}
          style={github}
          showLineNumbers
          lineNumberStyle={{ color: '#8c959f', minWidth: '2.5em', paddingRight: '1em', userSelect: 'none' }}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.75rem', background: '#fff' }}
          wrapLongLines
        >
          {content}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-auto">
      <div className="prose prose-sm max-w-none prose-headings:text-[#1f2328] prose-p:text-[#1f2328] prose-a:text-[#0969da] prose-code:text-[#1f2328] prose-code:before:content-none prose-code:after:content-none prose-img:rounded prose-table:text-sm">
        <ReactMarkdown
          rehypePlugins={[rehypeSanitize]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

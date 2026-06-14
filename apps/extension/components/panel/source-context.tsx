import { formatSource } from './panel-display';

export function SourceContext({ domain, url }: { domain: string | null; url: string | null }) {
  const source = formatSource(domain, url);

  if (!source) {
    return null;
  }

  return (
    <div className="min-w-0 truncate text-xs leading-5 text-slate-500" title={source.title}>
      <span className="font-semibold text-slate-700">{source.domain}</span>
      {source.path ? <span className="text-slate-500"> {source.path}</span> : null}
    </div>
  );
}

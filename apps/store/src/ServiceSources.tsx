import type { ServiceSource } from './chat';
import './service-sources.css';

/** Content is rendered as text, and URLs have already been restricted to the official HTTPS host. */
export function ServiceSources({ sources }: { sources: ServiceSource[] }) {
  if (!sources.length) return null;
  return <section className="service-sources" aria-label="Fuentes oficiales">
    {sources.map((source) => <article key={`${source.sourceId}:${source.chunkOrder}`} className="service-source">
      <h3>{source.heading}</h3>
      <p className="service-scope">Ámbito: {source.applicability === 'propio' ? 'productos propios de Coolbox' : source.applicability === 'marketplace' ? 'Marketplace' : source.applicability === 'ambos' ? 'Coolbox y Marketplace' : 'no determinado'}</p>
      <p className="service-content">{source.content}</p>
      <p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> · Revisada: {source.checkedAt}</p>
    </article>)}
  </section>;
}

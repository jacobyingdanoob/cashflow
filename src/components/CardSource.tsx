import type { CardSource as Source } from "../game/types";
export default function CardSource({ source }: { source?: Source }) {
  if (!source) return null;
  return (
    <details className="card-source">
      <summary>Adapted card · source & rules</summary>
      <p>{source.adaptation}</p>
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.label} ↗
      </a>
    </details>
  );
}

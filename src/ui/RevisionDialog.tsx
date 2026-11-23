import { useState } from "react";
import type { ProjectRevision } from "../core/project";
import { fmtDate } from "./store";

export interface RevisionOffer {
  title: string;
  file: string;
  summary: string[];
  warnings?: string[];
  changes: { title: string; items: string[] }[];
  mappings?: { id: string; label: string; links: number }[];
  destinations?: Map<string, string>;
  occupied?: Set<string>;
  destinationLabel?: string;
}

export function RevisionDialog({ offer, onFinish }: { offer: RevisionOffer; onFinish: (result: Map<string, string> | null) => void }) {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const apply = () => {
    const result = new Map<string, string>();
    const used = new Set(offer.occupied);
    for (const item of offer.mappings ?? []) {
      const value = entries[item.id]?.trim();
      if (!value) continue;
      const dest = offer.destinations?.get(value);
      if (!dest || used.has(dest)) {
        setError(`Destino inválido ou já usado para ${item.label}: ${value}.`);
        return;
      }
      result.set(item.id, dest);
      used.add(dest);
    }
    onFinish(result);
  };
  const remaining = offer.mappings?.reduce((total, item) => total + (entries[item.id]?.trim() ? 0 : item.links), 0) ?? 0;
  return (
    <div className="help-backdrop" onClick={() => onFinish(null)}>
      <div className="help settings" role="dialog" aria-label={offer.title} onClick={(event) => event.stopPropagation()}>
        <div className="settings-head"><h2>{offer.title}</h2><button onClick={() => onFinish(null)}>Cancelar</button></div>
        <div className="settings-body stack">
          <p><b>{offer.file}</b></p>
          <ul>{offer.summary.map((item) => <li key={item}>{item}</li>)}</ul>
          {offer.warnings?.map((item) => <p key={item} className="bad">{item}</p>)}
          {offer.changes.filter((group) => group.items.length).map((group) => (
            <details key={group.title}>
              <summary>{group.title} ({group.items.length})</summary>
              <ul>{group.items.slice(0, 100).map((item, i) => <li key={i}>{item}</li>)}</ul>
              {group.items.length > 100 && <small>Primeiros 100 registros exibidos.</small>}
            </details>
          ))}
          {!!offer.mappings?.length && (
            <details open>
              <summary>Correspondência manual ({offer.mappings.length})</summary>
              <p>Informe {offer.destinationLabel} na versão recebida. Referências sem destino ficam na cópia anterior.</p>
              {offer.mappings.map((item) => (
                <label key={item.id} className="row">
                  <span>{item.label}{item.links ? ` · ${item.links} vínculo(s)` : ""}</span>
                  <input value={entries[item.id] ?? ""} onChange={(e) => setEntries({ ...entries, [item.id]: e.target.value })} />
                </label>
              ))}
            </details>
          )}
          {!!remaining && <p className="bad">{remaining} vínculo(s) ficarão somente na versão anterior.</p>}
          {error && <p role="alert" className="bad">{error}</p>}
          <div className="row"><button className="primary" onClick={apply}>Aplicar revisão</button></div>
        </div>
      </div>
    </div>
  );
}

export function RevisionHistory({ entries, busy, onClose, onRestore, onDownload }: {
  entries: ProjectRevision[];
  busy: boolean;
  onClose: () => void;
  onRestore: (entry: ProjectRevision) => void;
  onDownload: (entry: ProjectRevision) => void;
}) {
  const labels = { ifc: "Revisão de modelo", schedule: "Revisão de cronograma", restore: "Restauração" };
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help settings" role="dialog" aria-label="Histórico de revisões" onClick={(event) => event.stopPropagation()}>
        <div className="settings-head"><h2>Histórico de revisões</h2><button onClick={onClose}>Fechar</button></div>
        <div className="settings-body stack">
          <p>Restaurar recupera a obra como estava antes do registro selecionado. O estado atual também ganha uma cópia no histórico.</p>
          {entries.slice().reverse().map((entry) => (
            <section key={entry.id}>
              <h4>{labels[entry.kind]} · {entry.source.name}</h4>
              <p>{entry.number === undefined ? "" : `Revisão ${entry.number} · `}{new Date(entry.date).toLocaleString("pt-BR")} · {entry.author}{entry.dataDate === null ? "" : ` · Corte ${fmtDate(entry.dataDate)}`}</p>
              <p>{entry.summary}</p>
              {entry.source.hash && <small title={entry.source.hash}>SHA-256 {entry.source.hash.slice(0, 12)}…</small>}
              <div className="row">
                <button disabled={busy} onClick={() => onDownload(entry)}>Baixar estado anterior</button>
                <button disabled={busy} onClick={() => onRestore(entry)}>Restaurar estado anterior</button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

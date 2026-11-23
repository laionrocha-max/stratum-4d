import { useEffect, useState } from "react";
import { useConfig } from "../backend/config";
import type { P6ProjectInfo, ProjectSummary } from "../backend/types";
import type { P6Connection } from "../core/reporting";
import { PROJECT_VERSION, type StratumProject } from "../core/project";
import type { Schedule } from "../core/types";
import { fmtDate, useStore } from "./store";
import { useTerms } from "./terms";

export function ProjectsDialog({
  onClose,
  onOpen,
  onSave,
  onNew,
  onMetadata,
  onDeleted,
  onImportP6,
  initialTab = "database",
}: {
  onClose: () => void;
  onOpen: (id: string) => Promise<void>;
  onSave: (asNew: boolean) => Promise<void>;
  onNew: (name: string) => void;
  onMetadata: (id: string, project: StratumProject, previousVersion: number, version: number) => void;
  onDeleted: (id: string) => void;
  onImportP6: (schedule: Schedule, connection: P6Connection) => void;
  initialTab?: "database" | "p6";
}) {
  const { backend } = useConfig();
  const t = useTerms();
  const { currentProjectId, schedule, projectKey, busy: workspaceBusy } = useStore();
  const [tab, setTab] = useState<"database" | "p6">(initialTab);
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = () =>
    backend
      .listProjects()
      .then(setList)
      .catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);
  const visible = list?.filter((project) => (showArchived || !project.archived) &&
    `${project.code} ${project.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMsg("");
    try {
      await action();
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const manage = (p: ProjectSummary, kind: "rename" | "duplicate" | "archive") => void run(async () => {
    const title = kind === "archive" ? undefined : window.prompt(kind === "rename" ? "Nome da obra" : "Nome da cópia", kind === "rename" ? p.name : `${p.name} (cópia)`)?.trim();
    if (kind !== "archive" && !title) return;
    const saved = await backend.getProject(p.id);
    if (!saved) throw new Error("A obra não está mais na biblioteca.");
    const duplicate = kind === "duplicate";
    const id = duplicate ? crypto.randomUUID() : p.id;
    const project = {
      ...saved.project,
      version: Math.max(saved.project.version, PROJECT_VERSION),
      title: title ?? saved.project.title,
      savedAt: new Date().toISOString(),
      projectKey: duplicate ? id : saved.project.projectKey ?? p.id,
      archived: kind === "archive" ? !saved.project.archived : duplicate ? undefined : saved.project.archived,
    };
    const version = await backend.saveProject(id, project, duplicate ? undefined : saved.version);
    if (!duplicate) onMetadata(id, project, saved.version, version);
    await load();
    setMsg(duplicate ? "Cópia criada." : "Biblioteca atualizada.");
  });
  const locked = busy || workspaceBusy;

  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help settings" role="dialog" aria-label="Projetos" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2>Projetos</h2>
          <button onClick={onClose}>Fechar</button>
        </div>
        <p className="muted">{backend.label}</p>
        <div className="tabs">
          <button className={tab === "database" ? "active" : ""} onClick={() => setTab("database")}>
            Biblioteca
          </button>
          <button className={tab === "p6" ? "active" : ""} onClick={() => setTab("p6")}>
            Importar do P6
          </button>
        </div>
        <div className="settings-body">
          {tab === "database" && (
            <div className="stack">
              <div className="row">
                <button className="primary" disabled={locked} onClick={() => {
                  const name = window.prompt("Nome da nova obra")?.trim();
                  if (name) onNew(name);
                }}>Nova obra</button>
                <button
                  disabled={(!schedule && !projectKey) || locked}
                  onClick={() => void run(async () => {
                    await onSave(false);
                    setMsg("Obra salva.");
                    await load();
                  })}
                >
                  Salvar obra atual
                </button>
                {currentProjectId && (
                  <button
                    disabled={(!schedule && !projectKey) || locked}
                    onClick={() => void run(async () => {
                      await onSave(true);
                      setMsg("Obra salva como nova.");
                      await load();
                    })}
                  >
                    Salvar como nova
                  </button>
                )}
              </div>
              <div className="row">
                <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar obras" placeholder="Buscar por nome ou código" />
                <label><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivadas</label>
              </div>
              {list === null ? (
                <p className="muted">Carregando…</p>
              ) : visible?.length === 0 ? (
                <p className="muted">{list.length ? "Nenhuma obra corresponde à busca." : "Crie uma obra ou salve na biblioteca a obra que está aberta."}</p>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.project}</th>
                      <th>Nome</th>
                      <th>{t.dataDate}</th>
                      <th>Salva em</th>
                      <th>Por</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visible?.map((p) => (
                      <tr key={p.id} className={p.id === currentProjectId ? "current" : ""}>
                        <td>
                          <b>{p.code}</b>
                        </td>
                        <td>{p.name}{p.archived ? " (arquivada)" : ""}</td>
                        <td>{fmtDate(p.dataDate)}</td>
                        <td>
                          {new Date(p.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} (v{p.version})
                        </td>
                        <td>{p.updatedBy ?? ""}</td>
                        <td>
                          <button className="link" disabled={locked} onClick={() => void run(async () => {
                            await onOpen(p.id);
                            onClose();
                          })}>Abrir</button>
                          <details className="project-row-menu">
                            <summary>Ações</summary>
                            <button disabled={locked} onClick={() => manage(p, "rename")}>Renomear</button>
                            <button disabled={locked} onClick={() => manage(p, "duplicate")}>Duplicar</button>
                            <button disabled={locked} onClick={() => manage(p, "archive")}>{p.archived ? "Restaurar" : "Arquivar"}</button>
                            <button disabled={locked} onClick={() => void run(async () => {
                              if (!window.confirm(`Excluir "${p.name}" da biblioteca? Cronograma, vínculos e vistas desta cópia serão excluídos. Os IFCs originais não serão apagados.`)) return;
                              await backend.deleteProject(p.id);
                              onDeleted(p.id);
                              await load();
                            })}>Excluir</button>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {tab === "p6" && <P6Import onImport={onImportP6} onClose={onClose} />}
          {msg && <p className={/conflict|error|cannot|someone else|fail/i.test(msg) ? "bad" : "muted"}>{msg}</p>}
        </div>
      </div>
    </div>
  );
}

function P6Import({ onImport, onClose }: { onImport: (s: Schedule, c: P6Connection) => void; onClose: () => void }) {
  const { backend } = useConfig();
  const [conns, setConns] = useState<P6Connection[]>([]);
  const [conn, setConn] = useState("");
  const [projects, setProjects] = useState<P6ProjectInfo[] | null>(null);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!backend.caps.p6) return;
    backend
      .getP6()
      .then((c) => {
        setConns(c);
        if (c[0]) setConn(c[0].id);
      })
      .catch((e) => setMsg(e.message));
  }, [backend]);

  if (!backend.caps.p6) return <p className="muted">A conexão com o P6 requer o aplicativo para computador ou um servidor Stratum. No navegador, importe o cronograma em um arquivo XER.</p>;
  if (!conns.length) return <p className="muted">Nenhuma conexão com o P6. Adicione uma em Configurações → Primavera P6.</p>;
  const shown = (projects ?? []).filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="stack">
      <div className="row">
        <select value={conn} onChange={(e) => (setConn(e.target.value), setProjects(null))}>
          {conns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg("Connecting to P6…");
            try {
              setProjects(await backend.p6Projects(conn));
              setMsg("");
            } catch (e) {
              setMsg((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Listar projetos
        </button>
        {projects && <input placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />}
      </div>
      {projects && (
        <table className="data">
          <thead>
            <tr>
              <th>ID do projeto</th>
              <th>Nome</th>
              <th>Data de corte</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 300).map((p) => (
              <tr key={p.objectId}>
                <td>
                  <b>{p.code}</b>
                </td>
                <td>{p.name}</td>
                <td>{p.dataDate.slice(0, 10)}</td>
                <td>
                  <button
                    className="link"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setMsg(`Importing ${p.code}…`);
                      try {
                        const s = await backend.p6Import(conn, p.objectId);
                        onImport(s, conns.find((c) => c.id === conn)!);
                        onClose();
                      } catch (e) {
                        setMsg((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    importar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {msg && <p className={/fail|error|cannot|refused|denied/i.test(msg) ? "bad" : "muted"}>{msg}</p>}
    </div>
  );
}

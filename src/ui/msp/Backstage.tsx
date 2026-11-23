// MS Project's File tab (Backstage): a green column of commands on the left
// and the chosen page on the right, covering the ribbon and the view.

import { ArrowLeft } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { projectStatistics } from "../../core/msp";
import { printPage } from "../files";
import type { ClassicActions } from "../classicParts";
import { useStore } from "../store";
import { mspDateText } from "./sheet";
import { useMsp } from "./state";

type Page = "info" | "new" | "open" | "save" | "print" | "export" | "options";

const Tile = ({ title, sub, onClick, disabled }: { title: string; sub?: string; onClick: () => void; disabled?: boolean }) => (
  <button className="bs-tile" onClick={onClick} disabled={disabled}>
    <b>{title}</b>
    {sub && <span>{sub}</span>}
  </button>
);

export function Backstage({ a, onClose }: { a: ClassicActions; onClose: () => void }) {
  const s = useStore((x) => x.schedule);
  const [page, setPage] = useState<Page>(s ? "info" : "new");
  const stats = useMemo(() => (s ? projectStatistics(s) : null), [s]);
  const none = !s;
  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const nav: [Page | "save-now" | "close", string, boolean?][] = [
    ["info", "Info", none],
    ["new", "New"],
    ["open", "Open"],
    ["save-now", "Save", none],
    ["save", "Save As", none],
    ["print", "Print", none],
    ["export", "Export", none],
    ["options", "Options"],
  ];
  const body: Record<Page, ReactNode> = {
    info: s && stats && (
      <>
        <h2>Informações</h2>
        <div className="bs-info">
          <div>
            <Tile title="Informações do projeto" sub="Start and finish dates, status date, calendar and priority." onClick={go(() => useMsp.getState().open("projectInfo"))} />
            <Tile title="Estatísticas do projeto" sub="Current, baseline and actual dates, work and cost." onClick={go(() => useMsp.getState().open("statistics"))} />
            <Tile title="Alterar período de trabalho" sub="Calendars, holidays and work weeks." onClick={go(() => useMsp.getState().open("workingTime"))} />
          </div>
          <dl className="bs-props">
            <dt>Título</dt>
            <dd>{s.projectName}</dd>
            <dt>Projeto</dt>
            <dd>{s.projectCode}</dd>
            <dt>Data de início</dt>
            <dd>{mspDateText(stats.current.start)}</dd>
            <dt>Data de término</dt>
            <dd>{mspDateText(stats.current.finish)}</dd>
            <dt>Data de status</dt>
            <dd>{mspDateText(s.dataDate)}</dd>
            <dt>% concluído</dt>
            <dd>{stats.percentComplete}%</dd>
            <dt>Tarefas</dt>
            <dd>{s.activities.length}</dd>
            <dt>Origem</dt>
            <dd>{s.sourceFormat === "mspdi" ? "Microsoft Project XML" : s.sourceFormat === "xer" ? "Primavera P6 XER" : (s.sourceFormat ?? "Stratum")}</dd>
          </dl>
        </div>
      </>
    ),
    new: (
      <>
        <h2>Novo</h2>
        <div className="bs-tiles">
          <Tile title="220 kV GIS Substation" sub="Sample project (UAE)" onClick={go(() => a.sample("gis"))} />
          <Tile title="Edifício de concreto armado" sub="Small sample project" onClick={go(() => a.sample("rc"))} />
          <Tile title="Novo a partir de um cronograma existente…" sub="P6 XER or Microsoft Project XML" onClick={go(a.importSchedule)} />
        </div>
      </>
    ),
    open: (
      <>
        <h2>Abrir</h2>
        <div className="bs-tiles col">
          <Tile title="Projetos" sub={`Open a project from ${a.dbLabel}`} onClick={go(a.projects)} />
          <Tile title="Procurar" sub="Open a Stratum project file (.stratum.json)" onClick={go(a.openFile)} />
          <Tile title="Importar XER ou XML do Microsoft Project" sub="P6 .xer or MS Project .xml (File › Save As › XML in MS Project)" onClick={go(a.importSchedule)} />
          <Tile title="Importar do P6" sub="Pull a project from a P6 connection" onClick={go(a.importP6)} />
        </div>
      </>
    ),
    save: (
      <>
        <h2>Salvar como</h2>
        <div className="bs-tiles col">
          <Tile title="Salvar como novo projeto" sub={`A copy in ${a.dbLabel}`} onClick={go(a.saveAsNew)} disabled={none} />
          <Tile title="Microsoft Project XML (*.xml)" sub="Opens in MS Project 2010 and later" onClick={go(a.exportMspdi)} disabled={none} />
          <Tile title="Primavera P6 XER (*.xer)" sub="Import into P6 Professional or EPPM" onClick={go(a.exportXer)} disabled={none} />
          <Tile title="Arquivo de projeto Stratum (*.stratum.json)" sub="Schedule, model links and settings" onClick={go(a.saveFile)} disabled={none} />
        </div>
      </>
    ),
    print: (
      <>
        <h2>Imprimir</h2>
        <p>Imprime a vista atual. Para gráficos de Gantt largos, escolha paisagem e ajuste à largura da página.</p>
        <div className="bs-tiles">
          <Tile title="Imprimir" sub="Current view" onClick={go(() => void printPage(`${s?.projectCode ?? "Project"} – Gantt Chart`))} disabled={none} />
        </div>
      </>
    ),
    export: (
      <>
        <h2>Exportar</h2>
        <div className="bs-tiles col">
          <Tile title="Criar documento PDF/XPS" sub="Print the current view to PDF" onClick={go(() => void printPage(`${s?.projectCode ?? "Project"}`))} disabled={none} />
          <Tile title="Salvar projeto como XML" sub="Microsoft Project XML" onClick={go(a.exportMspdi)} disabled={none} />
          <Tile title="Salvar projeto como CSV para Excel" sub="Task list for Excel" onClick={go(a.exportCsv)} disabled={none} />
          <Tile title="Salvar projeto como XER" sub="Primavera P6" onClick={go(a.exportXer)} disabled={none} />
        </div>
      </>
    ),
    options: (
      <>
        <h2>Opções</h2>
        <div className="bs-tiles col">
          <Tile title="Opções do projeto" sub="New task mode, calculation, currency, critical slack" onClick={go(() => useMsp.getState().open("options"))} />
          <Tile title="Configurações do Stratum" sub="Interface, data, P6 connections, email, users" onClick={go(() => a.settings("interface"))} />
        </div>
      </>
    ),
  };
  return (
    <div className="msp-bs" role="dialog" aria-label="Arquivo">
      <nav className="msp-bs-nav">
        <button className="back" onClick={onClose} aria-label="Voltar" title="Voltar">
          <ArrowLeft size={22} aria-hidden />
        </button>
        {nav.map(([k, label, dis]) => (
          <button
            key={k}
            disabled={dis}
            className={page === k ? "on" : ""}
            onClick={() => {
              if (k === "save-now") return go(a.save)();
              if (k === "close") return onClose();
              setPage(k);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="msp-bs-page">{body[page]}</div>
    </div>
  );
}

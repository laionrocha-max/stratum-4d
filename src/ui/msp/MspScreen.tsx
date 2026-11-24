// The MS Project layout: green title bar with the Quick Access Toolbar, File
// (Backstage), the Task / Resource / Report / Project / View ribbon tabs and
// the contextual Format tab, the Timeline, the current view with its vertical
// view label, the Details pane (Task Form) and the status bar with view
// shortcuts and the zoom slider.

import {
  ArrowDownAZ,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartGantt,
  ClipboardPaste,
  Copy,
  Diamond,
  Download,
  Eraser,
  FileInput,
  Flag,
  GalleryHorizontal,
  Group,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Info,
  LayoutDashboard,
  Link2,
  ListFilter,
  ListPlus,
  ListTree,
  Maximize2,
  Minus,
  MoveRight,
  Network,
  Pin,
  Plus,
  Printer,
  Redo2,
  Ruler,
  Save,
  Scale,
  ScanSearch,
  Scissors,
  ScrollText,
  Search,
  Sheet,
  StickyNote,
  Table,
  TableProperties,
  Undo2,
  Unlink,
  Upload,
  UserPlus,
  Users,
  UsersRound,
  Ban,
  CheckCheck,
  ChartColumn,
  Palette,
  Type,
  Repeat,
  Route,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buildGanttRows } from "../../core/wbs";
import type { ClassicActions } from "../classicParts";
import { DataDateInput, EmptySample } from "../classicParts";
import { ganttCommand } from "../Gantt";
import { ModeSwitch, ThemeButton } from "../ModeSwitch";
import { DisplaysButton } from "../display/Displays";
import { ContextMenuHost, useCtx, type CtxItem } from "../p6/ContextMenu";
import { copySelected, cutSelected, paste } from "../p6/commands";
import { TrainingButton } from "../training/Training";
import { fmtDate, useStore } from "../store";
import { printPage } from "../files";
import {
  deleteSelected,
  indent,
  insertSummaryTask,
  insertTask,
  linkSelected,
  markOnTrack,
  moveTasks,
  outdent,
  respectLinks,
  selectedTasks,
  setMode,
  setPercent,
  toggleInactive,
  unlinkSelected,
  commitEdit,
} from "./actions";
import { Backstage } from "./Backstage";
import { MspGantt } from "./MspGantt";
import { AssignResourcesDialog, DateRangeDialog, LevelingDialog, MoveProjectDialog, OptionsDialog, ProjectInfoDialog, SetBaselineDialog, SortDialog, StatisticsDialog, UpdateProjectDialog, ZoomDialog } from "./ProjectDialogs";
import { FILTER_NAMES, GROUP_NAMES, TABLES } from "./sheet";
import { useMsp, zoomIn, zoomOut, ZOOM_STEPS, type MspFilter, type MspTable, type MspView } from "./state";
import { TaskForm } from "./TaskForm";
import { TaskInfoDialog } from "./TaskInfo";
import { MspTimeline } from "./Timeline";
import { CalendarView, NetworkDiagram, ResourceInfoDialog, ResourceSheet, ResourceUsageView, TaskUsage, TeamPlanner, levelAll, clearLeveling, nextOverallocation } from "./Views";
import { WorkingTimeDialog } from "./WorkingTime";
import { BarStylesDialog, CustomFieldsDialog, FilterEditDialog, RecurringDialog } from "./Extras";
import { ResourcePanel } from "../Analysis";

type RibbonTab = "task" | "resource" | "report" | "project" | "view" | "format";

function Group_({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rb-group">
      <div className="rb-buttons">{children}</div>
      <div className="rb-label">{label}</div>
    </div>
  );
}
const Big = ({ Icon, label, onClick, disabled, active, menu }: { Icon: LucideIcon; label: string; onClick?: () => void; disabled?: boolean; active?: boolean; menu?: () => CtxItem[] }) => (
  <button
    className={`rb-big ${active ? "active" : ""}`}
    disabled={disabled}
    onClick={(e) => {
      if (menu) {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        useCtx.getState().show(r.left, r.bottom, menu());
      } else onClick?.();
    }}
  >
    <Icon size={24} strokeWidth={1.5} aria-hidden />
    <span>
      {label}
      {menu ? " ▾" : ""}
    </span>
  </button>
);
const Small = ({ label, onClick, disabled, active, Icon, menu, title }: { label: string; onClick?: () => void; disabled?: boolean; active?: boolean; Icon?: LucideIcon; menu?: () => CtxItem[]; title?: string }) => (
  <button
    className={`rb-small ${active ? "active" : ""}`}
    disabled={disabled}
    title={title}
    onClick={(e) => {
      if (menu) {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        useCtx.getState().show(r.left, r.bottom, menu());
      } else onClick?.();
    }}
  >
    {Icon && <Icon size={14} strokeWidth={1.7} aria-hidden />}
    <span>
      {label}
      {menu ? " ▾" : ""}
    </span>
  </button>
);
const Check = ({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <label className="rb-check">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} /> {label}
  </label>
);

const VIEW_LABEL: Record<MspView, string> = {
  gantt: "Gráfico de Gantt",
  tracking: "Gantt de acompanhamento",
  "task-sheet": "Planilha de tarefas",
  "task-usage": "Uso de tarefas",
  network: "Diagrama de rede",
  calendar: "Calendário",
  "team-planner": "Planejador de equipe",
  "resource-sheet": "Planilha de recursos",
  "resource-usage": "Uso de recursos",
  "resource-graph": "Gráfico de recursos",
};
const TASK_VIEWS: MspView[] = ["gantt", "tracking", "task-sheet", "task-usage", "network", "calendar"];
const viewName = (v: MspView) => VIEW_LABEL[v];

export function MspScreen({ a, banners, status }: { a: ClassicActions; banners: ReactNode; status: ReactNode }) {
  const schedule = useStore((s) => s.schedule);
  const selected = useStore((s) => s.selectedActivity);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const filterText = useStore((s) => s.ganttFilter.text);
  const setFilterText = useStore((s) => s.setGanttFilter);
  const dirty = useStore((s) => s.scheduleDirty);
  const m = useMsp();
  const { view, format } = m;
  const [tab, setTab] = useState<RibbonTab>("task");
  const [fileOpen, setFileOpen] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);
  const act = schedule?.activities.find((x) => x.id === selected) ?? null;
  const none = !schedule;
  const ganttLike = view === "gantt" || view === "tracking" || view === "task-sheet";
  const setView = (v: MspView) => m.set({ view: v });

  // Automatic calculation: reschedule shortly after each edit, as MS Project does.
  useEffect(() => {
    if (!m.autoCalc || !dirty || !schedule) return;
    const t = setTimeout(() => useStore.getState().scheduleDirty && a.schedule(), 250);
    return () => clearTimeout(t);
  }, [m.autoCalc, dirty, schedule, a]);

  // MS Project shortcuts that the sheet does not already handle.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      const ctrl = e.ctrlKey || e.metaKey;
      const st = useStore.getState();
      if (ctrl && e.key.toLowerCase() === "f") (e.preventDefault(), findRef.current?.focus());
      else if (!typing && e.key === "Insert") (e.preventDefault(), insertTask());
      else if (!typing && e.key === "Delete" && (st.selectedActivities.size || st.selectedActivity || useMsp.getState().selWbs.size)) (e.preventDefault(), deleteSelected());
      else if (ctrl && !typing && e.key.toLowerCase() === "z") (e.preventDefault(), st.undo());
      else if (ctrl && !typing && e.key.toLowerCase() === "y") (e.preventDefault(), st.redo());
      else if (ctrl && !typing && e.key.toLowerCase() === "c") copySelected();
      else if (ctrl && !typing && e.key.toLowerCase() === "x") cutSelected();
      else if (ctrl && !typing && e.key.toLowerCase() === "v") paste();
      else if (ctrl && e.key.toLowerCase() === "p") (e.preventDefault(), void printPage(`${st.schedule?.projectCode ?? "Project"} – ${viewName(useMsp.getState().view)}`));
      else if (e.altKey && e.key === "F10") (e.preventDefault(), useMsp.getState().open("assignResources"));
      else if (!typing && e.shiftKey && e.key === "F2") (e.preventDefault(), useMsp.getState().open("taskInfo"));
      else if (!typing && ctrl && e.key === "F2") (e.preventDefault(), e.shiftKey ? unlinkSelected() : linkSelected());
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const outlineMenu = (): CtxItem[] => {
    const s = useStore.getState().schedule;
    if (!s) return [];
    const depth = new Map<string, number>();
    for (const r of buildGanttRows(s, "current")) if (r.kind === "wbs") depth.set(r.id, r.depth);
    const show = (lvl: number | null) => useStore.getState().setCollapsedWbs(new Set(lvl === null ? [] : [...depth].filter(([, d]) => d >= lvl - 1).map(([id]) => id)));
    return [{ label: "Todas as subtarefas", onClick: () => show(null) }, ...[1, 2, 3, 4, 5].map((n) => ({ label: `Level ${n}`, onClick: () => show(n) }))];
  };
  const tablesMenu = (): CtxItem[] => (Object.keys(TABLES) as MspTable[]).map((k) => ({ label: TABLES[k].label, checked: m.table === k, onClick: () => m.set({ table: k }) }));
  const sortMenu = (): CtxItem[] => [
    ...[
      ["start", "by Start Date"],
      ["finish", "by Finish Date"],
      ["priority", "by Priority"],
      ["cost", "by Cost"],
      ["id", "by ID"],
    ].map(([k, l]) => ({ label: l, checked: m.sort.by === k, onClick: () => m.set({ sort: { by: k as never, desc: k === "priority" || k === "cost" } }) })),
    "sep",
    { label: "Classificar por…", onClick: () => m.open("sort") },
  ];
  const timescaleMenu = (): CtxItem[] =>
    [
      [0.4, "Years"],
      [1, "Quarters"],
      [3, "Months"],
      [6, "Thirds of Months"],
      [12, "Weeks"],
      [24, "Days"],
      [48, "Hours"],
    ].map(([px, l]) => ({ label: l as string, checked: Math.abs(m.pxPerDay - (px as number)) < 0.01, onClick: () => m.set({ pxPerDay: px as number }) }));
  const viewsMenu = (list: MspView[]): CtxItem[] => list.map((v) => ({ label: viewName(v), checked: view === v, onClick: () => setView(v) }));
  const moveMenu = (): CtxItem[] => [
    { label: "1 Day", onClick: () => moveTasks(1) },
    { label: "1 Week", onClick: () => moveTasks(7) },
    { label: "4 Weeks", onClick: () => moveTasks(28) },
    "sep",
    { label: "Voltar um dia", onClick: () => moveTasks(-1) },
    { label: "Voltar uma semana", onClick: () => moveTasks(-7) },
  ];
  const inspect = () => {
    const s = useStore.getState().schedule;
    if (!s || !act) return;
    const drivers = s.relationships.filter((r) => r.successorId === act.id && r.driving).map((r) => s.activities.find((x) => x.id === r.predecessorId)?.name).filter(Boolean);
    const why = act.taskMode === "manual" ? "It is manually scheduled: its dates stay as entered." : act.constraint?.date ? `It has a constraint on ${fmtDate(act.constraint.date)}.` : drivers.length ? `Predecessors driving it: ${drivers.join(", ")}.` : act.status !== "not-started" ? `Actual start ${fmtDate(act.actualStart)}.` : "It starts at the project start or status date.";
    useStore.getState().setStatus(`Task Inspector – ${act.name}: start ${fmtDate(act.start)}. ${why}`);
  };
  const addToTimeline = () => {
    const s = useStore.getState().schedule;
    const ids = new Set(selectedTasks());
    if (!s || !ids.size) return;
    const on = !s.activities.find((x) => ids.has(x.id))?.onTimeline;
    commitEdit({ ...s, activities: s.activities.map((x) => (ids.has(x.id) ? { ...x, onTimeline: on } : x)) }, on ? "Add to Timeline" : "Remove from Timeline");
    if (on) m.set({ showTimeline: true });
  };
  const baselineMenu = (): CtxItem[] => [
    { label: "Definir linha de base…", onClick: () => m.open("setBaseline") },
    { label: "Limpar linha de base…", onClick: () => m.open("clearBaseline") },
  ];

  const Body: Record<RibbonTab, ReactNode> = {
    task: (
      <>
        <Group_ label="Exibir">
          <Big Icon={ChartGantt} label="Gráfico de Gantt" menu={() => viewsMenu([...TASK_VIEWS, "team-planner", "resource-sheet", "resource-usage"])} active={ganttLike} />
        </Group_>
        <Group_ label="Área de transferência">
          <Big Icon={ClipboardPaste} label="Colar" onClick={paste} disabled={none} />
          <Small label="Recortar" Icon={Scissors} onClick={cutSelected} disabled={!act} />
          <Small label="Copiar" Icon={Copy} onClick={copySelected} disabled={!act} />
        </Group_>
        <Group_ label="Cronograma">
          <div className="rb-sched">
            <div className="rb-grid">
              {[0, 25, 50, 75, 100].map((p) => (
                <button key={p} className="rb-pct" title={`${p}% concluído`} disabled={!act} onClick={() => setPercent(p)}>
                  {p}%
                </button>
              ))}
            </div>
            <div className="rb-sched-row">
              <button className="rb-icon" title="Diminuir recuo da tarefa (Alt+Shift+←)" onClick={outdent} disabled={none}>
                <IndentDecrease size={15} aria-hidden />
              </button>
              <button className="rb-icon" title="Aumentar recuo da tarefa (Alt+Shift+→)" onClick={indent} disabled={none}>
                <IndentIncrease size={15} aria-hidden />
              </button>
              <button className="rb-icon" title="Vincular as tarefas selecionadas (Ctrl+F2)" onClick={linkSelected} disabled={none}>
                <Link2 size={15} aria-hidden />
              </button>
              <button className="rb-icon" title="Desvincular tarefas (Ctrl+Shift+F2)" onClick={unlinkSelected} disabled={!act}>
                <Unlink size={15} aria-hidden />
              </button>
            </div>
          </div>
          <Small label="Marcar conforme o plano" Icon={CheckCheck} onClick={markOnTrack} disabled={!act} />
          <Small label="Respeitar dependências" Icon={Link2} onClick={respectLinks} disabled={!act} />
          <Small label={act?.inactive ? "Activate" : "Desativar"} Icon={Ban} onClick={toggleInactive} disabled={!act} />
          <Small label="Dividir tarefa" Icon={Scissors} onClick={() => (m.set({ splitMode: !m.splitMode }), m.splitMode || useStore.getState().setStatus("Split Task: click a bar where the work should stop. A one-day split is added; repeat to make it longer."))} active={m.splitMode} disabled={none} />
        </Group_>
        <Group_ label="Tarefas">
          <Big Icon={Pin} label="Agendar manualmente" onClick={() => setMode("manual")} disabled={!act} active={act?.taskMode === "manual"} />
          <Big Icon={CalendarClock} label="Agendar automaticamente" onClick={() => setMode("auto")} disabled={!act} active={!!act && act.taskMode !== "manual"} />
          <Small label="Inspecionar" Icon={ScanSearch} onClick={inspect} disabled={!act} />
          <Small label="Mover" Icon={MoveRight} menu={moveMenu} disabled={!act} />
          <Small label="Modo" Icon={CalendarClock} menu={() => [{ label: "Agendar manualmente", onClick: () => setMode("manual") }, { label: "Agendar automaticamente", onClick: () => setMode("auto") }]} disabled={!act} />
        </Group_>
        <Group_ label="Inserir">
          <Big Icon={ListPlus} label="Tarefa" onClick={() => insertTask()} disabled={none} />
          <Small label="Resumo" Icon={ListTree} onClick={insertSummaryTask} disabled={none} />
          <Small label="Marco" Icon={Diamond} onClick={() => insertTask("<New Milestone>", true)} disabled={none} />
          <Small label="Tarefa recorrente" Icon={Repeat} onClick={() => m.open("recurring")} disabled={none} />
        </Group_>
        <Group_ label="Propriedades">
          <Big Icon={Info} label="Informações" onClick={() => m.open("taskInfo")} disabled={!act} />
          <Small label="Anotações" Icon={StickyNote} onClick={() => m.open("taskInfo", "notes")} disabled={!act} />
          <Small label="Detalhes" Icon={TableProperties} onClick={() => m.set({ details: !m.details })} active={m.details} />
          <Small label="Adicionar à linha do tempo" Icon={GalleryHorizontal} onClick={addToTimeline} disabled={!act} active={!!act?.onTimeline} />
        </Group_>
        <Group_ label="Edição">
          <Small label="Ir à tarefa" Icon={ScrollText} onClick={() => ganttCommand("scroll-to-selected")} disabled={!act} />
          <Small label="Localizar" Icon={Search} onClick={() => findRef.current?.focus()} disabled={none} />
          <Small label="Limpar" Icon={Eraser} menu={() => [{ label: "Limpar filtro", onClick: () => (m.set({ filter: "all", highlight: "all", customFilter: null }), setFilterText({ text: "" })) }, { label: "Limpar classificação e agrupamento", onClick: () => m.set({ sort: { by: "id", desc: false }, group: "none" }) }]} disabled={none} />
        </Group_>
      </>
    ),
    resource: (
      <>
        <Group_ label="Exibir">
          <Big Icon={UsersRound} label="Planejador de equipe" onClick={() => setView("team-planner")} active={view === "team-planner"} disabled={none} />
        </Group_>
        <Group_ label="Atribuições">
          <Big Icon={Users} label="Atribuir recursos" onClick={() => m.open("assignResources")} disabled={!act} />
        </Group_>
        <Group_ label="Inserir">
          <Big Icon={UserPlus} label="Adicionar recursos" onClick={() => setView("resource-sheet")} disabled={none} />
        </Group_>
        <Group_ label="Propriedades">
          <Big Icon={Info} label="Informações" onClick={() => (view === "resource-sheet" ? m.open("resourceInfo") : m.open("taskInfo", "resources"))} disabled={none} />
          <Small label="Detalhes" Icon={TableProperties} onClick={() => m.set({ details: !m.details })} active={m.details} />
        </Group_>
        <Group_ label="Nivelar">
          <Big Icon={Scale} label="Nivelar todos" onClick={levelAll} disabled={none} />
          <Small label="Opções de nivelamento" Icon={Scale} onClick={() => m.open("levelOptions")} disabled={none} />
          <Small label="Limpar nivelamento" Icon={Eraser} onClick={clearLeveling} disabled={none} />
          <Small label="Próxima superalocação" Icon={MoveRight} onClick={nextOverallocation} disabled={none} />
        </Group_>
      </>
    ),
    report: (
      <>
        <Group_ label="Ver relatórios">
          <Big Icon={LayoutDashboard} label="Painéis" onClick={a.dashboards} />
          <Big Icon={Users} label="Recursos" onClick={a.dashboards} />
          <Big Icon={CalendarRange} label="Custos" onClick={a.dashboards} />
          <Big Icon={ChartGantt} label="Em andamento" onClick={() => (m.set({ filter: "incomplete" }), setView("gantt"))} disabled={none} />
        </Group_>
        <Group_ label="Projeto">
          <Big Icon={Info} label="Estatísticas do projeto" onClick={() => m.open("statistics")} disabled={none} />
        </Group_>
        <Group_ label="Exportar">
          <Big Icon={Download} label="Relatórios visuais (CSV)" onClick={a.exportCsv} disabled={none} />
          <Small label="Imprimir" Icon={Printer} onClick={() => void printPage(`${schedule?.projectCode ?? "Project"} – ${viewName(view)}`)} disabled={none} />
        </Group_>
      </>
    ),
    project: (
      <>
        <Group_ label="Propriedades">
          <Big Icon={Info} label="Informações do projeto" onClick={() => m.open("projectInfo")} disabled={none} />
          <Big Icon={CalendarDays} label="Alterar período de trabalho" onClick={() => m.open("workingTime")} disabled={none} />
          <Small label="Campos personalizados" Icon={Table} onClick={() => m.open("customFields")} disabled={none} />
          <Small label="Opções" Icon={TableProperties} onClick={() => m.open("options")} />
        </Group_>
        <Group_ label="Cronograma">
          <Big Icon={CalendarCheck} label="Calcular projeto" onClick={a.schedule} disabled={none} />
          <Big Icon={Flag} label="Definir linha de base" menu={baselineMenu} disabled={none} />
          <Small label="Mover projeto" Icon={MoveRight} onClick={() => m.open("moveProject")} disabled={none} />
          <Small label="Atribuir linha de base a partir de arquivo" Icon={FileInput} onClick={a.assignBaseline} disabled={none} />
        </Group_>
        <Group_ label="Situação">
          <div className="rb-field">
            <DataDateInput label="Data de status" />
          </div>
          <Big Icon={CalendarRange} label="Atualizar projeto" onClick={() => m.open("updateProject")} disabled={none} />
        </Group_>
        <Group_ label="Dados">
          <Big Icon={FileInput} label="Importar do P6" onClick={a.importP6} />
          {a.pushP6 && <Big Icon={Upload} label="Atualizar P6" onClick={a.pushP6} />}
          <Small label="Salvar como XML do Microsoft Project" Icon={Download} onClick={a.exportMspdi} disabled={none} />
        </Group_>
      </>
    ),
    view: (
      <>
        <Group_ label="Modos de exibição de tarefas">
          <Big Icon={ChartGantt} label="Gráfico de Gantt" onClick={() => setView("gantt")} active={view === "gantt"} />
          <Big Icon={TableProperties} label="Uso de tarefas" onClick={() => setView("task-usage")} active={view === "task-usage"} disabled={none} />
          <Small label="Diagrama de rede" Icon={Network} onClick={() => setView("network")} active={view === "network"} disabled={none} />
          <Small label="Calendário" Icon={CalendarDays} onClick={() => setView("calendar")} active={view === "calendar"} disabled={none} />
          <Small label="Outras exibições" Icon={Table} menu={() => viewsMenu(["tracking", "task-sheet"])} />
        </Group_>
        <Group_ label="Modos de exibição de recursos">
          <Big Icon={UsersRound} label="Planejador de equipe" onClick={() => setView("team-planner")} active={view === "team-planner"} disabled={none} />
          <Small label="Uso de recursos" Icon={Users} onClick={() => setView("resource-usage")} active={view === "resource-usage"} disabled={none} />
          <Small label="Planilha de recursos" Icon={Sheet} onClick={() => setView("resource-sheet")} active={view === "resource-sheet"} disabled={none} />
          <Small label="Gráfico de recursos" Icon={ChartColumn} onClick={() => setView("resource-graph")} active={view === "resource-graph"} disabled={none} />
        </Group_>
        <Group_ label="Dados">
          <Small label="Classificar" Icon={ArrowDownAZ} menu={sortMenu} disabled={!ganttLike} />
          <Small label="Estrutura de tópicos" Icon={ListTree} menu={outlineMenu} disabled={!ganttLike} />
          <Small label="Tabelas" Icon={Table} menu={tablesMenu} disabled={!ganttLike} />
          <div className="rb-dd">
            <span>
              <Highlighter size={13} aria-hidden /> Realce:
            </span>
            <select value={m.highlight} onChange={(e) => m.set({ highlight: e.target.value as MspFilter })} disabled={!ganttLike} aria-label="Realçar">
              {FILTER_NAMES.filter(([k]) => k !== "date-range" && k !== "summary").map(([k, l]) => (
                <option key={k} value={k}>
                  {k === "all" ? "[No Highlight]" : l}
                </option>
              ))}
            </select>
          </div>
          <div className="rb-dd">
            <span>
              <ListFilter size={13} aria-hidden /> Filtro:
            </span>
            <select
              value={m.customFilter ? `custom:${m.customFilter}` : m.filter}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new") return m.open("filterEdit");
                if (v === "__edit") return m.open("filterEdit", m.customFilter ?? undefined);
                if (v.startsWith("custom:")) return m.set({ customFilter: v.slice(7), filter: "all" });
                if (v === "date-range") return m.open("filter");
                m.set({ filter: v as MspFilter, customFilter: null });
              }}
              disabled={!ganttLike}
              aria-label="Filtro"
            >
              {FILTER_NAMES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
              {m.customFilters.length > 0 && (
                <optgroup label="Personalizado">
                  {m.customFilters.map((f) => (
                    <option key={f.name} value={`custom:${f.name}`}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="__new">Novo filtro…</option>
              {m.customFilter && <option value="__edit">Edit '{m.customFilter}'…</option>}
            </select>
          </div>
          <div className="rb-dd">
            <span>
              <Group size={13} aria-hidden /> Agrupar por:
            </span>
            <select value={m.group} onChange={(e) => m.set({ group: e.target.value as typeof m.group })} disabled={!ganttLike} aria-label="Agrupar por">
              {GROUP_NAMES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </Group_>
        <Group_ label="Zoom">
          <Small label="Escala de tempo" Icon={Ruler} menu={timescaleMenu} disabled={none} />
          <Small label="Zoom" Icon={Search} menu={() => [{ label: "Aproximar", onClick: zoomIn }, { label: "Afastar", onClick: zoomOut }, { label: "Zoom…", onClick: () => m.open("timescale") }]} disabled={none} />
          <Big Icon={Maximize2} label="Projeto inteiro" onClick={() => ganttCommand("fit")} disabled={none} />
          <Big Icon={ScrollText} label="Tarefas selecionadas" onClick={() => ganttCommand("scroll-to-selected")} disabled={!act} />
        </Group_>
        <Group_ label="Dividir exibição">
          <Check label="Linha do tempo" checked={m.showTimeline} onChange={(v) => m.set({ showTimeline: v })} />
          <Check label="Detalhes" checked={m.details} onChange={(v) => m.set({ details: v })} />
        </Group_>
      </>
    ),
    format: (
      <>
        <Group_ label="Colunas">
          <Big Icon={Plus} label="Inserir coluna" onClick={() => (document.querySelector(".mspg-hcell.add") as HTMLElement | null)?.click()} disabled={!ganttLike || none} />
          <Small label="Tabelas" Icon={Table} menu={tablesMenu} disabled={!ganttLike} />
        </Group_>
        <Group_ label="Formato">
          <Big Icon={Palette} label="Estilos de barra" onClick={() => m.open("barStyles", "bars")} disabled={none} />
          <Small label="Estilos de texto" Icon={Type} onClick={() => m.open("barStyles", "text")} disabled={none} />
        </Group_>
        <Group_ label="Estilos de barra">
          <Check label="Tarefas críticas" checked={format.criticalTasks} onChange={(v) => m.setFormat({ criticalTasks: v })} />
          <Check label="Folga" checked={format.slack} onChange={(v) => m.setFormat({ slack: v })} />
          <Check label="Tarefas atrasadas" checked={format.lateTasks} onChange={(v) => m.setFormat({ lateTasks: v })} />
          <Check label="Linha de base" checked={format.baseline} onChange={(v) => m.setFormat({ baseline: v })} />
          <Check label="Linhas de dependência" checked={format.linkLines} onChange={(v) => m.setFormat({ linkLines: v })} />
          <Check label="Linhas de grade" checked={format.gridlines} onChange={(v) => m.setFormat({ gridlines: v })} />
        </Group_>
        <Group_ label="Caminho da tarefa">
          <Big
            Icon={Route}
            label="Caminho da tarefa"
            active={format.taskPath !== "none"}
            menu={() =>
              (
                [
                  ["predecessors", "Predecessors"],
                  ["driving", "Driving Predecessors"],
                  ["successors", "Successors"],
                  ["none", "Remove Highlighting"],
                ] as const
              ).map(([k, l]) => ({ label: l, checked: format.taskPath === k, onClick: () => m.setFormat({ taskPath: k }) }))
            }
          />
        </Group_>
        <Group_ label="Texto da barra">
          <div className="rb-dd">
            <span>À direita das barras:</span>
            <select value={format.barText} onChange={(e) => m.setFormat({ barText: e.target.value as typeof format.barText })} aria-label="Bar text">
              <option value="resources">Nomes dos recursos</option>
              <option value="name">Nome da tarefa</option>
              <option value="none">Nenhum</option>
            </select>
          </div>
        </Group_>
        <Group_ label="Mostrar ou ocultar">
          <Check label="Número da estrutura de tópicos" checked={format.outlineNumber} onChange={(v) => m.setFormat({ outlineNumber: v })} />
          <Check label="Tarefa-resumo do projeto" checked={format.projectSummary} onChange={(v) => m.setFormat({ projectSummary: v })} />
          <Check label="Tarefas-resumo" checked={format.summaryTasks} onChange={(v) => m.setFormat({ summaryTasks: v })} />
        </Group_>
      </>
    ),
  };

  const tabs: [RibbonTab, string][] = [
    ["task", "Tarefa"],
    ["resource", "Recurso"],
    ["report", "Relatório"],
    ["project", "Projeto"],
    ["view", "Exibir"],
  ];
  const close = () => m.set({ dialog: null, dialogTab: undefined });
  const dialogs: Record<NonNullable<typeof m.dialog>, ReactNode> = {
    taskInfo: <TaskInfoDialog onClose={close} />,
    projectInfo: <ProjectInfoDialog onClose={close} />,
    statistics: <StatisticsDialog onClose={close} />,
    workingTime: <WorkingTimeDialog onClose={close} />,
    setBaseline: <SetBaselineDialog onClose={close} />,
    clearBaseline: <SetBaselineDialog onClose={close} clear />,
    assignResources: <AssignResourcesDialog onClose={close} />,
    resourceInfo: <ResourceInfoDialog onClose={close} />,
    options: <OptionsDialog onClose={close} />,
    updateProject: <UpdateProjectDialog onClose={close} />,
    moveProject: <MoveProjectDialog onClose={close} />,
    levelOptions: <LevelingDialog onClose={close} />,
    timescale: <ZoomDialog onClose={close} />,
    sort: <SortDialog onClose={close} />,
    filter: <DateRangeDialog onClose={close} />,
    recurring: <RecurringDialog onClose={close} />,
    customFields: <CustomFieldsDialog onClose={close} />,
    filterEdit: <FilterEditDialog onClose={close} />,
    columns: null,
    barStyles: <BarStylesDialog onClose={close} />,
    groupBy: null,
  };
  const needsSchedule = m.dialog && m.dialog !== "options";

  const viewBody = () => {
    if (!schedule) return <EmptySample a={a} />;
    switch (view) {
      case "gantt":
        return <MspGantt />;
      case "tracking":
        return <MspGantt tracking />;
      case "task-sheet":
        return <MspGantt chart={false} />;
      case "task-usage":
        return <TaskUsage />;
      case "network":
        return <NetworkDiagram />;
      case "calendar":
        return <CalendarView />;
      case "team-planner":
        return <TeamPlanner />;
      case "resource-sheet":
        return <ResourceSheet />;
      case "resource-usage":
        return <ResourceUsageView />;
      case "resource-graph":
        return (
          <div className="msp-graph">
            <ResourcePanel />
          </div>
        );
    }
  };
  const zoomIdx = ZOOM_STEPS.findIndex((z) => Math.abs(z - m.pxPerDay) < 0.01);

  return (
    <div className="classic msp-app">
      <div className="cl-titlebar msp-titlebar">
        <span className="qat">
          <button title="Salvar (Ctrl+S)" onClick={a.save} disabled={none}>
            <Save size={14} aria-hidden />
          </button>
          <button title="Desfazer (Ctrl+Z)" onClick={() => useStore.getState().undo()} disabled={!canUndo}>
            <Undo2 size={14} aria-hidden />
          </button>
          <button title="Refazer (Ctrl+Y)" onClick={() => useStore.getState().redo()} disabled={!canRedo}>
            <Redo2 size={14} aria-hidden />
          </button>
          <button title="Calcular projeto (F9)" onClick={a.schedule} disabled={none}>
            <CalendarCheck size={14} aria-hidden />
          </button>
        </span>
        <span className="cl-title center">{schedule ? `${schedule.projectCode}  -  Stratum 4D` : "Stratum 4D"}</span>
        {ganttLike && <span className="msp-context">Ferramentas do gráfico de Gantt</span>}
        <ModeSwitch />
        <DisplaysButton className="tb cl-train" />
        <TrainingButton className="tb cl-train" />
        <ThemeButton />
      </div>
      <div className="msp-tabrow" role="tablist">
        <button className="msp-filetab" onClick={() => setFileOpen(true)}>
          Arquivo
        </button>
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
        <button onClick={a.help}>Ajuda</button>
        {ganttLike && (
          <button role="tab" aria-selected={tab === "format"} className={`msp-format ${tab === "format" ? "active" : ""}`} onClick={() => setTab("format")}>
            Formato
          </button>
        )}
        <span className="spacer" />
        <div className="msp-tell">
          <Search size={13} aria-hidden />
          <input ref={findRef} placeholder="Diga o que você quer fazer" value={filterText} onChange={(e) => setFilterText({ text: e.target.value })} aria-label="Localizar tarefas" />
        </div>
      </div>
      <div className="msp-ribbon">{Body[tab === "format" && !ganttLike ? "task" : tab]}</div>
      {banners}
      {m.showTimeline && TASK_VIEWS.includes(view) && (
        <div className="msp-tlwrap">
          <div className="msp-vlabel">LINHA DO TEMPO</div>
          <MspTimeline />
        </div>
      )}
      <div className="msp-mainview">
        <div className="msp-vlabel">{VIEW_LABEL[view]}</div>
        <div className="msp-viewbody">{viewBody()}</div>
      </div>
      {m.details && schedule && TASK_VIEWS.includes(view) && (
        <div className="msp-taskform">
          <div className="msp-vlabel">FORMULÁRIO DE TAREFA</div>
          <div className="msp-formbody">
            <TaskForm />
          </div>
        </div>
      )}
      <div className="cl-statusbar msp-status">
        <span>Pronto</span>
        <button
          className="msp-newmode"
          disabled={none}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const s = useStore.getState().schedule;
            if (!s) return;
            useCtx.getState().show(r.left, r.top - 60, [
              { label: "Agendamento automático – o programa calcula as datas da tarefa", checked: s.newTaskMode !== "manual", onClick: () => commitEdit({ ...s, newTaskMode: "auto" }, "New tasks: auto scheduled") },
              { label: "Agendamento manual – as datas da tarefa não são atualizadas automaticamente", checked: s.newTaskMode === "manual", onClick: () => commitEdit({ ...s, newTaskMode: "manual" }, "New tasks: manually scheduled") },
            ]);
          }}
        >
          Novas tarefas: {schedule?.newTaskMode === "manual" ? "Agendamento manual" : "Agendamento automático"}
        </button>
        {(m.filter !== "all" || m.customFilter || filterText) && <span className="msp-flag">Filtro aplicado</span>}
        {!m.autoCalc && dirty && <span className="msp-flag">Calcular</span>}
        <span className="cl-msg">{status}</span>
        <span className="spacer" />
        {(
          [
            ["gantt", ChartGantt, "Gráfico de Gantt"],
            ["task-usage", TableProperties, "Uso de tarefas"],
            ["team-planner", UsersRound, "Planejador de equipe"],
            ["resource-sheet", Sheet, "Planilha de recursos"],
          ] as [MspView, LucideIcon, string][]
        ).map(([v, Icon, title]) => (
          <button key={v} title={title} className={view === v ? "on" : ""} onClick={() => setView(v)} disabled={none && v !== "gantt"}>
            <Icon size={14} aria-hidden />
          </button>
        ))}
        <button title="Relatórios" onClick={a.dashboards}>
          <LayoutDashboard size={14} aria-hidden />
        </button>
        <button title="Afastar" onClick={zoomOut}>
          <Minus size={12} aria-hidden />
        </button>
        <input type="range" min={0} max={ZOOM_STEPS.length - 1} value={zoomIdx < 0 ? 5 : zoomIdx} aria-label="Zoom" onChange={(e) => m.set({ pxPerDay: ZOOM_STEPS[Number(e.target.value)] })} />
        <button title="Aproximar" onClick={zoomIn}>
          <Plus size={12} aria-hidden />
        </button>
      </div>
      {fileOpen && <Backstage a={a} onClose={() => setFileOpen(false)} />}
      {m.dialog && (!needsSchedule || schedule) && dialogs[m.dialog]}
      <ContextMenuHost />
    </div>
  );
}

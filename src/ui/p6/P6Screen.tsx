// The P6 Professional layout: title bar, menus, toolbar, Directory bar
// (left), workspace windows with tabs, the Activities window (layout bar,
// activity table + Gantt or Activity Network, lower pane with Activity
// Details, usage profiles / spreadsheets or Trace Logic), the Command bar
// (right) and the status bar.

import { TsldView } from "./Tsld";
import { TrackingWindow } from "./Tracking";
import { ActivityDocs } from "./Documents";
import { download as saveFile } from "../files";
import {
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  BarChart3,
  Calculator,
  CalendarClock,
  CalendarRange,
  ChartGantt,
  ChartLine,
  ChartNoAxesGantt,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  ClipboardPaste,
  Columns3,
  Copy,
  DatabaseZap,
  FileChartColumn,
  FileInput,
  FileOutput,
  FileText,
  Filter,
  Flag,
  FolderKanban,
  FolderOpen,
  Gauge,
  GitBranch,
  GitFork,
  Highlighter,
  Layers,
  LayoutDashboard,
  LayoutPanelTop,
  Link2,
  ListOrdered,
  ListTree,
  Merge,
  MonitorUp,
  MoveHorizontal,
  Network,
  GitCommitHorizontal,
  NotebookPen,
  PanelBottom,
  PencilRuler,
  Plus,
  Printer,
  Receipt,
  Redo2,
  Save,
  Scissors,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  SpellCheck,
  SquareCheck,
  Table2,
  Tags,
  Trash2,
  TriangleAlert,
  Undo2,
  Users,
  Wand2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePrefs } from "./prefs";
import { useConfig } from "../../backend/config";
import { estimateProgress, recalcAssignmentCosts, removeProgress } from "../../core/ops";
import { ActivityEditor, type EditorSection } from "../ActivityEditor";
import { CostPanel, ResourcePanel } from "../Analysis";
import { DataDateInput, EmptySample, FILTERS, IconBtn, MenuBar, type ClassicActions, type MenuItem } from "../classicParts";
import { ganttCommand } from "../Gantt";
import { ModeSwitch, ThemeButton } from "../ModeSwitch";
import { fmtDate, useStore, type GanttFilterKind } from "../store";
import { useTraining } from "../training/engine";
import { TrainingButton } from "../training/Training";
import { ActivityTable } from "./ActivityTable";
import {
  lastCopied,
  pasteIntoCells,
  selectionTsv,
  addActivity,
  collapseAll,
  copySelected,
  cutSelected,
  deleteSelected,
  dissolveSelected,
  expandAll,
  expandToLevel,
  fillDownSelected,
  linkSelected,
  paste,
  selectAll,
  unlinkSelected,
  useP6,
  type P6Window,
} from "./commands";
import { ContextMenuHost } from "./ContextMenu";
import { P6Dialogs, printLayout } from "./Dialogs";
import { exportLayoutXlsx } from "./Dialogs3";
import { openBudgets } from "./Dialogs5";
import { SAMPLE_ORDER, SAMPLES } from "../../core/samples";
import { EnterpriseProjectsWindow } from "./EnterpriseProjects";
import { loginEnabled, signOut } from "../LoginGate";
import { STOCK_LAYOUTS, useLayout, type LowerTab, type LowerView } from "./layout";
import { AssignmentsWindow, NetworkView, ProjectsWindow, RegisterWindow, ResourcesWindow, TraceLogicView, UsageSpreadsheet, WbsWindow } from "./Windows";

const WINDOW_LABEL: Record<P6Window, string> = {
  activities: "Atividades",
  wbs: "EAP",
  assignments: "Atribuições",
  resources: "Recursos",
  projects: "Projetos",
  documents: "Entregáveis e documentos",
  expenses: "Despesas",
  thresholds: "Limites",
  issues: "Pendências",
  risks: "Riscos",
  tracking: "Acompanhamento",
};

const LOWER_TABS: [LowerTab, string, EditorSection[]][] = [
  ["general", "Geral", ["general"]],
  ["status", "Situação", ["status", "dates"]],
  ["resources", "Recursos", ["resources"]],
  ["predecessors", "Predecessoras", ["predecessors"]],
  ["successors", "Sucessoras", ["successors"]],
  ["relationships", "Dependências", ["predecessors", "successors"]],
  ["codes", "Códigos", ["codes"]],
  ["steps", "Etapas", ["steps"]],
  ["notebook", "Anotações", ["notebook"]],
  ["udf", "UDFs", ["udf"]],
  ["wpdocs", "Entregáveis e documentos", []],
];

const LOWER_VIEWS: [LowerView | "resourceProfile" | "activityProfile", string][] = [
  ["details", "Detalhes da atividade"],
  ["resourceProfile", "Perfil de uso de recursos"],
  ["activityProfile", "Perfil de uso de atividades"],
  ["resourceUsage", "Planilha de uso de recursos"],
  ["activityUsage", "Planilha de uso de atividades"],
  ["trace", "Rastrear dependências"],
  ["none", "Nenhum"],
];

// ---------------------------------------------------------------- rails

interface RailItem {
  id: string;
  label: string;
  title: string;
  Icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function Rail({ side, items, label }: { side: "left" | "right"; items: (RailItem | "sep")[]; label: string }) {
  return (
    <nav className={`p6-rail p6-rail-${side}`} aria-label={label}>
      {items.map((it, i) =>
        it === "sep" ? (
          <span key={`sep${i}`} className="rail-sep" />
        ) : (
          <button key={it.id} className={it.active ? "on" : ""} title={it.title} onClick={it.onClick} disabled={it.disabled} aria-pressed={it.active}>
            <it.Icon size={20} strokeWidth={1.6} aria-hidden />
            <span>{it.label}</span>
          </button>
        ),
      )}
    </nav>
  );
}

function DirectoryBar({ a }: { a: ClassicActions }) {
  const win = useP6((s) => s.window);
  const show = useP6((s) => s.show);
  const none = !useStore((s) => s.schedule);
  const item = (id: P6Window, Icon: LucideIcon, title: string): RailItem => ({ id, label: WINDOW_LABEL[id], title, Icon, active: win === id, disabled: none && id !== "projects", onClick: () => show(id) });
  return (
    <Rail
      side="left"
      label="Diretório"
      items={[
        item("projects", FolderKanban, "Projects window"),
        item("resources", Users, "Resources window: the resource dictionary"),
        { id: "reports", label: "Relatórios", title: "Relatórios e painéis", Icon: FileChartColumn, onClick: a.dashboards },
        { ...item("tracking", Gauge, "Tracking: project-level table, Gantt and bar charts across a portfolio"), disabled: false },
        "sep",
        item("wbs", Network, "WBS window: edit the work breakdown structure"),
        item("activities", ListTree, "Activities window"),
        item("assignments", ClipboardList, "Assignments window: every resource assignment"),
        item("documents", FileText, "Work products and documents"),
        item("expenses", Receipt, "Project expenses"),
        item("thresholds", AlignVerticalSpaceAround, "Thresholds to monitor"),
        item("issues", TriangleAlert, "Project issues"),
        item("risks", ShieldAlert, "Project risks"),
        "sep",
        { id: "p6", label: "Importar do P6", title: "Importar um projeto de uma conexão com o P6", Icon: DatabaseZap, onClick: a.importP6 },
      ]}
    />
  );
}

function CommandBar({ a }: { a: ClassicActions }) {
  const win = useP6((s) => s.window);
  const open = useP6((s) => s.open);
  const schedule = useStore((s) => s.schedule);
  const sel = useStore((s) => s.selectedActivities);
  const canUndo = useStore((s) => s.past.length > 0);
  const clip = useStore((s) => s.clipboard);
  const none = !schedule;
  const n = sel.size;
  if (win !== "activities")
    return (
      <Rail
        side="right"
        label="Comandos"
        items={[
          { id: "f9", label: "Calcular cronograma", title: "Calcular cronograma (F9)", Icon: Calculator, onClick: () => useP6.getState().open("scheduleRun"), disabled: none },
          { id: "save", label: "Salvar", title: "Salvar alterações no banco de dados (Ctrl+S)", Icon: Save, onClick: a.save, disabled: none },
          { id: "undo", label: "Desfazer", title: "Desfazer (Ctrl+Z)", Icon: Undo2, onClick: () => useStore.getState().undo(), disabled: !canUndo },
          "sep",
          { id: "acts", label: "Atividades", title: "Voltar à tela de atividades", Icon: ListTree, onClick: () => useP6.getState().show("activities"), disabled: none },
        ]}
      />
    );
  return (
    <Rail
      side="right"
      label="Comandos"
      items={[
        { id: "add", label: "Adicionar", title: "Adicionar atividade após a selecionada (Ins)", Icon: Plus, onClick: addActivity, disabled: none },
        { id: "del", label: "Excluir", title: "Excluir as atividades selecionadas (Del)", Icon: Trash2, onClick: () => deleteSelected(), disabled: !n },
        { id: "cut", label: "Recortar", title: "Recortar (Ctrl+X)", Icon: Scissors, onClick: cutSelected, disabled: !n },
        { id: "copy", label: "Copiar", title: "Copiar (Ctrl+C)", Icon: Copy, onClick: copySelected, disabled: !n },
        { id: "paste", label: "Colar", title: "Colar (Ctrl+V)", Icon: ClipboardPaste, onClick: paste, disabled: !clip },
        { id: "dissolve", label: "Excluir e religar", title: "Excluir e vincular predecessoras às sucessoras", Icon: Merge, onClick: dissolveSelected, disabled: !n },
        { id: "renumber", label: "Renumerar", title: "Renumerar IDs de atividades", Icon: ListOrdered, onClick: () => open("renumber"), disabled: !n },
        { id: "link", label: "Vincular", title: "Vincular atividades selecionadas com relação término–início, na ordem da tabela", Icon: Link2, onClick: () => linkSelected("FS"), disabled: n < 2 },
        { id: "undo", label: "Desfazer", title: "Desfazer (Ctrl+Z)", Icon: Undo2, onClick: () => useStore.getState().undo(), disabled: !canUndo },
        { id: "fill", label: "Preencher para baixo", title: "Copiar o primeiro valor da coluna para as demais células selecionadas (Ctrl+E)", Icon: ArrowDownToLine, onClick: fillDownSelected, disabled: n < 2 },
        { id: "selall", label: "Selecionar tudo", title: "Selecionar todas as atividades exibidas (Ctrl+A)", Icon: SquareCheck, onClick: selectAll, disabled: none },
        { id: "spell", label: "Ortografia", title: "Verificar a ortografia dos nomes das atividades", Icon: SpellCheck, onClick: () => open("spelling"), disabled: none },
        "sep",
        { id: "apred", label: "Predecessoras", title: "Atribuir predecessoras", Icon: GitFork, onClick: () => open("assignPred"), disabled: n !== 1 },
        { id: "asucc", label: "Sucessoras", title: "Atribuir sucessoras", Icon: GitBranch, onClick: () => open("assignSucc"), disabled: n !== 1 },
        { id: "ares", label: "Recursos", title: "Atribuir recursos", Icon: Users, onClick: () => open("assignRes"), disabled: !n },
        { id: "acode", label: "Códigos", title: "Atribuir códigos de atividade", Icon: Tags, onClick: () => open("assignCode"), disabled: !n },
        "sep",
        { id: "expand", label: "Expandir tudo", title: "Expandir todos os grupos", Icon: ChevronsUpDown, onClick: expandAll, disabled: none },
        { id: "collapse", label: "Recolher tudo", title: "Recolher todos os grupos da EAP", Icon: ChevronsDownUp, onClick: collapseAll, disabled: none },
        { id: "f9", label: "Calcular cronograma", title: "Calcular cronograma (F9)", Icon: Calculator, onClick: () => useP6.getState().open("scheduleRun"), disabled: none },
        { id: "save", label: "Salvar", title: "Salvar alterações no banco de dados (Ctrl+S)", Icon: Save, onClick: a.save, disabled: none },
      ]}
    />
  );
}

// ---------------------------------------------------------------- keys

function useP6Keys(a: ClassicActions, find: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = !!el.closest("input, textarea, select, [contenteditable]");
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const st = useStore.getState();
      if (useP6.getState().dialog) return;
      if (ctrl && k === "f") {
        e.preventDefault();
        return find();
      }
      if (e.key === "F10") {
        e.preventDefault();
        return useP6.getState().open("level");
      }
      if (typing) return;
      if (useP6.getState().window !== "activities") {
        if (ctrl && k === "z") (e.preventDefault(), st.undo());
        else if (ctrl && k === "y") (e.preventDefault(), st.redo());
        return;
      }
      const act = (fn: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
      if (e.key === "Insert") act(addActivity);
      else if (e.key === "Delete" && st.selectedActivities.size) act(() => deleteSelected());
      else if (ctrl && k === "z" && !e.shiftKey) act(st.undo);
      else if ((ctrl && k === "y") || (ctrl && e.shiftKey && k === "z")) act(st.redo);
      else if (ctrl && k === "a") act(selectAll);
      else if (ctrl && k === "e") act(fillDownSelected);
      else if (ctrl && k === "l") act(() => linkSelected("FS"));
    };
    // Copy / cut / paste go through the clipboard events, so cells can travel to and from Excel.
    const inTable = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.activeElement;
      return !el?.closest("input, textarea, select, [contenteditable]") && !useP6.getState().dialog && useP6.getState().window === "activities";
    };
    const onCopy = (e: ClipboardEvent) => {
      if (!inTable(e) || !useStore.getState().selectedActivities.size || window.getSelection()?.toString()) return;
      e.preventDefault();
      const tsv = selectionTsv();
      e.clipboardData?.setData("text/plain", tsv);
      lastCopied.text = tsv;
      if (e.type === "cut") cutSelected();
      else copySelected();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!inTable(e)) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      // Our own copy (or nothing): paste activities. Anything else, e.g. cells from Excel: paste into cells.
      if (!text || text === lastCopied.text) return paste();
      pasteIntoCells(text);
    };
    window.addEventListener("keydown", on, true);
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCopy);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", on, true);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCopy);
      window.removeEventListener("paste", onPaste);
    };
  }, [a, find]);
}

// ---------------------------------------------------------------- lower pane

function LowerPane() {
  const schedule = useStore((s) => s.schedule);
  const selected = useStore((s) => s.selectedActivity);
  const lower = useLayout((s) => s.layout.lower);
  const tab = useLayout((s) => s.layout.lowerTab);
  const h = useLayout((s) => s.layout.lowerHeight);
  const set = useLayout((s) => s.set);
  const [profile, setProfile] = useState<null | "resourceProfile" | "activityProfile">(null);
  const act = schedule?.activities.find((x) => x.id === selected) ?? null;
  if (lower === "none" && !profile) return null;
  const grip = (e: React.MouseEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = h;
    const move = (m: MouseEvent) => set({ lowerHeight: Math.max(90, Math.min(window.innerHeight - 220, h0 - (m.clientY - y0))) });
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const viewSel = (
    <select
      className="p6-lowersel"
      value={profile ?? lower}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "resourceProfile" || v === "activityProfile") {
          setProfile(v);
          set({ lower: "details" });
        } else {
          setProfile(null);
          set({ lower: v as LowerView });
        }
      }}
      title="Mostrar na parte inferior"
    >
      {LOWER_VIEWS.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
  let body: ReactNode;
  if (profile) body = profile === "resourceProfile" ? <ResourcePanel /> : <CostPanel />;
  else if (lower === "resourceUsage") body = <UsageSpreadsheet by="resource" />;
  else if (lower === "activityUsage") body = <UsageSpreadsheet by="activity" />;
  else if (lower === "trace") body = <TraceLogicView />;
  else
    body = (
      <>
        <div className="p6-tabs" role="tablist">
          {LOWER_TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => set({ lowerTab: id })}>
              {label}
            </button>
          ))}
        </div>
        <div className="p6-lowerbody">
          {tab === "wpdocs" ? act ? <ActivityDocs activityId={act.id} /> : <p className="muted">Selecione uma atividade.</p> : <ActivityEditor bare only={(LOWER_TABS.find((d) => d[0] === tab) ?? LOWER_TABS[0])[2]} />}
        </div>
      </>
    );
  return (
    <div className="p6-lower" style={{ flex: `0 0 ${h}px` }}>
      <div className="p6-lowergrip" onMouseDown={grip} title="Arraste para redimensionar" />
      <div className="p6-lowerhead">
        {viewSel}
        {!profile && lower === "details" && (
          <>
            <span>
              Atividade <b>{act?.code ?? "—"}</b>
            </span>
            <span className="p6-actname">{act?.name ?? "No activity selected"}</span>
          </>
        )}
        <span className="spacer" />
        <span>
          Projeto <b>{schedule?.projectCode ?? "—"}</b>
        </span>
      </div>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------- screen

export function P6Screen({ a, banners, status, displays }: { a: ClassicActions; banners: ReactNode; status: ReactNode; displays?: { menu: MenuItem[]; dialog?: ReactNode } }) {
  const schedule = useStore((s) => s.schedule);
  const filter = useStore((s) => s.ganttFilter);
  const setFilter = useStore((s) => s.setGanttFilter);
  const tracking = useStore((s) => s.ganttTracking);
  const setTracking = useStore((s) => s.setGanttTracking);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undoLabel = useStore((s) => s.past[s.past.length - 1]?.label);
  const redoLabel = useStore((s) => s.future[0]?.label);
  const sel = useStore((s) => s.selectedActivities);
  const clip = useStore((s) => s.clipboard);
  const user = useConfig((s) => s.config.user);
  const layout = useLayout((s) => s.layout);
  const custom = useLayout((s) => s.customFilters);
  const setLayout = useLayout((s) => s.set);
  const win = useP6((s) => s.window);
  const tabs = useP6((s) => s.tabs);
  // User Preferences › Application › Look: P6 Professional's classic Windows look by default.
  const look = usePrefs((p) => p.p6Look ?? "classic");
  useEffect(() => {
    document.documentElement.dataset.p6look = look;
    return () => {
      delete document.documentElement.dataset.p6look;
    };
  }, [look]);
  // User Preferences › Application › Startup Window.
  useEffect(() => {
    const w = usePrefs.getState().startupWindow;
    if (w) useP6.getState().show(w as P6Window);
  }, []);
  const P = useP6();
  const findRef = useRef<HTMLInputElement>(null);
  const none = !schedule;
  const n = sel.size;
  const find = useMemo(
    () => () => {
      useP6.getState().show("activities");
      setTimeout(() => findRef.current?.focus(), 0);
    },
    [],
  );
  useP6Keys(a, find);
  const toggle = (k: "showTable" | "showGantt" | "network") => setLayout({ [k]: !layout[k] } as Partial<typeof layout>);
  const recalc = () => {
    const s = useStore.getState().schedule;
    if (!s) return;
    const r = recalcAssignmentCosts(s);
    useStore.getState().commit(r.schedule, "Recalculate assignment costs");
    useStore.getState().setStatus(`Recalculated costs on ${r.changed} assignments from resource prices.`);
  };
  const exportHtml = () => {
    const rows = [...document.querySelectorAll(".p6t-pane .p6t-row")].map((r) => [...r.querySelectorAll(".p6t-td")].map((c) => c.textContent ?? ""));
    const head = [...document.querySelectorAll(".p6t-pane .p6t-th span")].map((c) => c.textContent ?? "");
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(schedule?.projectName ?? "Layout")}</title><style>body{font:12px system-ui}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:2px 6px}</style><h3>${esc(`${schedule?.projectCode} – ${schedule?.projectName}`)}</h3><p>Data date ${fmtDate(schedule?.dataDate)} · ${esc(layout.name)} · visible rows</p><table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    saveFile(`${schedule?.projectCode ?? "layout"}.html`, html, "text/html");
  };

  const menus: [string, MenuItem[]][] = [
    [
      "Arquivo",
      [
        { label: "Abrir…", onClick: a.projects, shortcut: "Ctrl+O" },
        { label: "Salvar alterações", onClick: a.save, disabled: none, shortcut: "Ctrl+S" },
        { label: "Salvar como novo projeto", onClick: a.saveAsNew, disabled: none },
        "sep",
        { label: "Configurar página…", onClick: () => P.open("pageSetup"), disabled: none },
        { label: "Imprimir…", onClick: printLayout, disabled: none, shortcut: "Ctrl+P" },
        { label: "Publicar layout em HTML", onClick: exportHtml, disabled: none },
        { label: "Publicar site do projeto…", onClick: () => P.open("publishSite"), disabled: none },
        "sep",
        { label: "Importar…", onClick: a.importSchedule },
        { label: "Importar de uma conexão com o P6…", onClick: a.importP6 },
        { label: "Exportar… (XER)", onClick: a.exportXer, disabled: none },
        { label: "Exportar… (XML do Microsoft Project)", onClick: a.exportMspdi, disabled: none },
        { label: "Exportar layout atual para Excel (.xlsx)", onClick: () => void exportLayoutXlsx(), disabled: none },
        { label: "Importar do Excel…", onClick: () => P.open("excelImport"), disabled: none },
        { label: "Exportar para CSV", onClick: a.exportCsv, disabled: none },
        "sep",
        { label: "Abrir arquivo de projeto…", onClick: a.openFile },
        { label: "Salvar arquivo de projeto", onClick: a.saveFile, disabled: none },
        "sep",
        ...SAMPLE_ORDER.map((k) => ({ label: `Exemplo: ${SAMPLES[k].label}`, onClick: () => a.sample(k) })),
        ...(loginEnabled ? ["sep" as const, { label: "Sair", onClick: signOut }] : []),
      ],
    ],
    [
      "Editar",
      [
        { label: `Desfazer${undoLabel ? ` ${undoLabel}` : ""}`, onClick: () => useStore.getState().undo(), disabled: !canUndo, shortcut: "Ctrl+Z" },
        { label: `Refazer${redoLabel ? ` ${redoLabel}` : ""}`, onClick: () => useStore.getState().redo(), disabled: !canRedo, shortcut: "Ctrl+Y" },
        "sep",
        { label: "Recortar", onClick: cutSelected, disabled: !n, shortcut: "Ctrl+X" },
        { label: "Copiar", onClick: copySelected, disabled: !n, shortcut: "Ctrl+C" },
        { label: "Colar", onClick: paste, disabled: !clip, shortcut: "Ctrl+V" },
        "sep",
        { label: "Adicionar", onClick: addActivity, disabled: none, shortcut: "Ins" },
        { label: "Excluir", onClick: () => deleteSelected(), disabled: !n, shortcut: "Del" },
        { label: "Excluir e religar", onClick: dissolveSelected, disabled: !n },
        { label: "Renumerar IDs de atividades…", onClick: () => P.open("renumber"), disabled: !n },
        { label: "Vincular atividades", onClick: () => linkSelected("FS"), disabled: n < 2, shortcut: "Ctrl+L" },
        { label: "Desvincular atividades", onClick: unlinkSelected, disabled: n < 2 },
        { label: "Preencher para baixo", onClick: fillDownSelected, disabled: n < 2, shortcut: "Ctrl+E" },
        { label: "Selecionar tudo", onClick: selectAll, disabled: none, shortcut: "Ctrl+A" },
        "sep",
        { label: "Atribuir predecessoras…", onClick: () => P.open("assignPred"), disabled: n !== 1 },
        { label: "Atribuir sucessoras…", onClick: () => P.open("assignSucc"), disabled: n !== 1 },
        { label: "Atribuir recursos…", onClick: () => P.open("assignRes"), disabled: !n },
        { label: "Atribuir funções…", onClick: () => P.open("assignRole"), disabled: !n },
        { label: "Atribuir códigos de atividade…", onClick: () => P.open("assignCode"), disabled: !n },
        "sep",
        { label: "Localizar…", onClick: find, disabled: none, shortcut: "Ctrl+F" },
        { label: "Verificar ortografia…", onClick: () => P.open("spelling"), disabled: none },
        { label: "Preferências do usuário…", onClick: () => P.open("preferences") },
        { label: "Configurações de interface…", onClick: () => a.settings("interface") },
      ],
    ],
    [
      "Exibir",
      [
        { label: "Abrir layout…", onClick: () => P.open("layouts") },
        { label: "Salvar layout como…", onClick: () => P.open("layouts") },
        "sep",
        { label: "Mostrar tabela de atividades na parte superior", onClick: () => toggle("showTable"), checked: layout.showTable },
        { label: "Mostrar gráfico de Gantt na parte superior", onClick: () => setLayout({ showGantt: !layout.showGantt || layout.network || !!layout.tsld, network: false, tsld: false }), checked: layout.showGantt && !layout.network && !layout.tsld },
        { label: "Mostrar rede de atividades na parte superior", onClick: () => setLayout({ network: !layout.network, tsld: false }), checked: layout.network && !layout.tsld },
        { label: "Mostrar diagrama lógico com escala de tempo na parte superior", onClick: () => setLayout({ tsld: !layout.tsld }), checked: !!layout.tsld },
        ...LOWER_VIEWS.filter(([v]) => v !== "resourceProfile" && v !== "activityProfile").map(([v, l]) => ({ label: `Mostrar na parte inferior: ${l}`, onClick: () => setLayout({ lower: v as LowerView }), checked: layout.lower === v })),
        "sep",
        { label: "Colunas…", onClick: () => P.open("columns") },
        { label: "Filtros…", onClick: () => P.open("filters") },
        { label: "Agrupar e classificar…", onClick: () => P.open("groupSort") },
        { label: "Opções das barras do Gantt…", onClick: () => P.open("bars") },
        { label: "Escala de tempo…", onClick: () => P.open("timescale") },
        "sep",
        { label: "Expandir tudo", onClick: expandAll, disabled: none },
        { label: "Recolher tudo", onClick: collapseAll, disabled: none },
        { label: "Recolher até o nível 1 da EAP", onClick: () => expandToLevel(1), disabled: none },
        { label: "Recolher até o nível 2 da EAP", onClick: () => expandToLevel(2), disabled: none },
        { label: "Recolher até o nível 3 da EAP", onClick: () => expandToLevel(3), disabled: none },
        "sep",
        { label: "Aproximar", onClick: () => ganttCommand("zoom-in"), disabled: none },
        { label: "Afastar", onClick: () => ganttCommand("zoom-out"), disabled: none },
        { label: "Ajustar escala de tempo", onClick: () => ganttCommand("fit"), disabled: none },
        { label: "Ir à atividade selecionada", onClick: () => ganttCommand("scroll-to-selected"), disabled: !n },
        { label: "Destacar período", onClick: () => P.setSpotlight(!P.spotlight), checked: P.spotlight, disabled: none },
        { label: "Mostrar barras da linha de base", onClick: () => setTracking(!tracking), checked: tracking },
        { label: "Mostrar linha de progresso", onClick: () => useLayout.getState().setBars({ progressLine: !layout.bars.progressLine }), checked: !!layout.bars.progressLine },
        ...(displays ? (["sep", ...displays.menu] as MenuItem[]) : []),
      ],
    ],
    [
      "Projeto",
      [
        { label: "Calcular cronograma…", onClick: () => P.open("scheduleRun"), disabled: none, shortcut: "F9" },
        { label: "Opções de cálculo do cronograma…", onClick: () => P.open("scheduleOptions"), disabled: none },
        { label: "Nivelar recursos…", onClick: () => P.open("level"), disabled: none, shortcut: "F10" },
        { label: "Verificar cronograma…", onClick: () => P.open("checkSchedule"), disabled: none },
        "sep",
        { label: "Gerenciar linhas de base…", onClick: () => P.open("baselines"), disabled: none },
        { label: "Atribuir linhas de base… (de XER ou XML)", onClick: a.assignBaseline, disabled: none },
        "sep",
        { label: "Detalhes do projeto…", onClick: () => P.open("projectInfo"), disabled: none },
        { label: "Orçamentos…", onClick: () => openBudgets(null), disabled: none },
        ...(a.pushP6 ? [{ label: "Enviar avanço ao P6", onClick: a.pushP6 }] : []),
        "sep",
        { label: "Reports and Dashboards", onClick: a.dashboards },
      ],
    ],
    [
      "Empresa",
      [
        { label: "Projetos", onClick: () => P.show("projects") },
        { label: "Estrutura de projetos da empresa…", onClick: () => P.open("eps") },
        { label: "Portfólios de projetos…", onClick: () => P.open("portfolios") },
        { label: "Planejamento de capacidade…", onClick: () => P.open("capacity") },
        "sep",
        { label: "Recursos", onClick: () => P.show("resources"), disabled: none },
        { label: "Funções…", onClick: () => P.open("roles"), disabled: none },
        { label: "Taxas e turnos de recursos…", onClick: () => P.open("resourceRates"), disabled: none },
        { label: "Turnos de recursos…", onClick: () => P.open("shifts"), disabled: none },
        { label: "Curvas de recursos…", onClick: () => P.open("curves"), disabled: none },
        { label: "Contas de custos…", onClick: () => P.open("costAccounts"), disabled: none },
        { label: "OBS…", onClick: () => P.open("obs"), disabled: none },
        { label: "Matriz de pontuação de riscos…", onClick: () => P.open("riskMatrix"), disabled: none },
        { label: "Calendários…", onClick: () => P.open("calendars"), disabled: none },
        { label: "Códigos de atividade…", onClick: () => P.open("activityCodes"), disabled: none },
        { label: "Códigos de projeto…", onClick: () => P.open("projectCodes") },
        { label: "Códigos de recurso…", onClick: () => P.open("resourceCodes"), disabled: none },
        { label: "Categorias de despesas…", onClick: () => P.open("expenseCategories"), disabled: none },
        { label: "Campos definidos pelo usuário…", onClick: () => P.open("udfs"), disabled: none },
        { label: "Conexões com o P6…", onClick: () => a.settings("p6") },
      ],
    ],
    [
      "Ferramentas",
      [
        { label: "Alteração em massa…", onClick: () => P.open("globalChange"), disabled: none },
        { label: "Atualizar avanço…", onClick: () => P.open("updateProgress"), disabled: none },
        { label: "Publicar › Site do projeto…", onClick: () => P.open("publishSite"), disabled: none },
        { label: "Estimativa de cima para baixo…", onClick: () => P.open("topDown"), disabled: none },
        {
          label: "Estimar avanço das atividades selecionadas",
          onClick: () => {
            const st = useStore.getState();
            if (!st.schedule) return;
            const r = estimateProgress(st.schedule, st.selectedActivities.size ? st.selectedActivities : undefined);
            st.commit(r.schedule, "Estimate progress");
            st.setStatus(`Estimated progress to the data date: ${r.started} started, ${r.finished} finished, ${r.progressed} in progress.`);
          },
          disabled: none,
        },
        {
          label: "Remover avanço das atividades selecionadas",
          onClick: () => {
            const st = useStore.getState();
            if (!st.schedule || !st.selectedActivities.size || !window.confirm(`Remove all progress from ${st.selectedActivities.size} activities?`)) return;
            const r = removeProgress(st.schedule, st.selectedActivities);
            st.commit(r.schedule, "Remove progress");
            st.setStatus(`Removed progress from ${r.changed} activities. Press F9 to reschedule.`);
          },
          disabled: !n,
        },
        { label: "Registrar desempenho do período…", onClick: () => P.open("periods"), disabled: none },
        { label: "Recalcular custos das atribuições", onClick: recalc, disabled: none },
        { label: "Verificar cronograma…", onClick: () => P.open("checkSchedule"), disabled: none },
        { label: "Comparar cronogramas (Claim Digger)…", onClick: () => P.open("claimDigger"), disabled: none },
        { label: "Registro de cálculo do cronograma…", onClick: () => P.open("scheduleLog"), disabled: none },
        { label: "Verificar ortografia…", onClick: () => P.open("spelling"), disabled: none },
        "sep",
        { label: "Relatórios", onClick: a.dashboards },
        { label: "E-mails programados", onClick: a.dashboards },
      ],
    ],
    [
      "Administração",
      [
        { label: "Usuários…", onClick: () => a.settings("users") },
        { label: "Banco de dados…", onClick: () => a.settings("data") },
        { label: "E-mail (SMTP)…", onClick: () => a.settings("email") },
        "sep",
        { label: "Calendário de períodos financeiros…", onClick: () => P.open("financialPeriods"), disabled: none },
        { label: "Preferências…", onClick: () => a.settings("interface") },
      ],
    ],
    [
      "Ajuda",
      [
        { label: "Modo de treinamento…", onClick: () => useTraining.getState().openCatalog(true) },
        { label: "Primeiros passos", onClick: a.help, shortcut: "?" },
      ],
    ],
  ];

  const quick = [...FILTERS, ...custom.map((f) => [`custom:${f.id}`, f.name] as [string, string])];

  const windowBody = (() => {
    if (!schedule && win !== "projects" && win !== "tracking") return <EmptySample a={a} />;
    switch (win) {
      case "wbs":
        return <WbsWindow />;
      case "resources":
        return <ResourcesWindow />;
      case "assignments":
        return <AssignmentsWindow />;
      case "projects":
        return a.openOne && a.openCombined ? <EnterpriseProjectsWindow onOpenOne={a.openOne} onOpenCombined={a.openCombined} onImport={a.projects} onImportToDb={a.importToDb} onSave={a.saveDb} /> : <ProjectsWindow onOpen={a.projects} />;
      case "tracking":
        return <TrackingWindow onDashboards={a.dashboards} />;
      case "documents":
      case "expenses":
      case "thresholds":
      case "issues":
      case "risks":
        return <RegisterWindow kind={win} />;
      default:
        return (
          <>
            <div className="p6-layoutbar">
              <button className="p6-layoutbtn" onClick={() => P.open("layouts")} title="Abrir ou salvar um layout">
                Layout: {layout.name} <ChevronDown size={12} aria-hidden />
              </button>
              <label className="p6-drop">
                Filtro:
                <select
                  value={filter.kind !== "all" ? filter.kind : layout.filters.length === 1 && custom.some((f) => f.id === layout.filters[0]) ? `custom:${layout.filters[0]}` : "all"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("custom:")) {
                      setFilter({ kind: "all" });
                      setLayout({ filters: [v.slice(7)] });
                    } else {
                      setFilter({ kind: v as GanttFilterKind });
                      if (v === "all") setLayout({ filters: [] });
                    }
                  }}
                >
                  {quick.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <button className="p6-drop p6-blbtn" onClick={() => setTracking(!tracking)} aria-pressed={tracking} title="Mostrar barras da linha de base abaixo de cada atividade">
                {tracking ? "✓ " : ""}Barras da linha de base
              </button>
              {layout.filters.length > 0 && (
                <button className="p6-drop" onClick={() => P.open("filters")} title="Filtros do layout em uso">
                  <Filter size={12} aria-hidden /> {layout.filters.length} filter{layout.filters.length > 1 ? "s" : ""}
                </button>
              )}
              <span className="spacer" />
              <input ref={findRef} className="p6-find" placeholder="Localizar atividade por ID ou nome" value={filter.text} onChange={(e) => setFilter({ text: e.target.value })} />
            </div>
            <div className="p6-upper">{layout.tsld ? <TsldView /> : layout.network ? <NetworkView /> : <ActivityTable onSchedule={a.schedule} />}</div>
            <LowerPane />
          </>
        );
    }
  })();

  return (
    <div className="classic p6-app">
      <div className="cl-titlebar">
        <img className="cl-logo logo-light" src="./stratum-logo.png" alt="Stratum 4D" />
        <img className="cl-logo logo-dark" src="./stratum-logo-dark.png" alt="" aria-hidden />
        <span className="cl-title">{schedule ? `${WINDOW_LABEL[win]} : ${schedule.projectCode} – ${schedule.projectName}` : WINDOW_LABEL[win]}</span>
        <span className="spacer" />
        <ModeSwitch />
        {displays && (
          <button className="tb cl-train" onClick={() => (displays.menu[0] as { onClick: () => void }).onClick()} title="Monitores: abrir cada vista em uma janela própria">
            <MonitorUp size={14} aria-hidden /> Monitores
          </button>
        )}
        <TrainingButton className="tb cl-train" />
        <ThemeButton />
      </div>
      <MenuBar className="cl-menubar" menus={menus} />
      <div className="cl-toolbar p6-toolbar">
        <IconBtn Icon={FolderOpen} title="Abrir projeto (Ctrl+O)" onClick={a.projects} />
        <IconBtn Icon={Save} title="Salvar alterações (Ctrl+S)" onClick={a.save} disabled={none} />
        <span className="tsep" />
        <IconBtn Icon={Printer} title="Imprimir" onClick={printLayout} disabled={none} />
        <IconBtn Icon={PencilRuler} title="Configurar página" onClick={() => P.open("pageSetup")} disabled={none} />
        <IconBtn Icon={FileInput} title="Importar XER ou XML" onClick={a.importSchedule} />
        <IconBtn Icon={FileOutput} title="Exportar XER" onClick={a.exportXer} disabled={none} />
        <span className="tsep" />
        <IconBtn Icon={Undo2} title={`Desfazer${undoLabel ? `: ${undoLabel}` : ""} (Ctrl+Z)`} onClick={() => useStore.getState().undo()} disabled={!canUndo} />
        <IconBtn Icon={Redo2} title={`Refazer${redoLabel ? `: ${redoLabel}` : ""} (Ctrl+Y)`} onClick={() => useStore.getState().redo()} disabled={!canRedo} />
        <span className="tsep" />
        <IconBtn Icon={LayoutPanelTop} title="Abrir ou salvar layout" onClick={() => P.open("layouts")} />
        <IconBtn Icon={Table2} title="Mostrar ou ocultar a tabela de atividades" onClick={() => toggle("showTable")} disabled={none} />
        <IconBtn Icon={ChartGantt} title="Mostrar ou ocultar o gráfico de Gantt" onClick={() => toggle("showGantt")} disabled={none} />
        <IconBtn Icon={PanelBottom} title="Mostrar ou ocultar o painel inferior" onClick={() => setLayout({ lower: layout.lower === "none" ? "details" : "none" })} disabled={none} />
        <IconBtn Icon={Network} title="Rede de atividades" onClick={() => setLayout({ network: !layout.network, tsld: false })} disabled={none} />
        <IconBtn Icon={GitCommitHorizontal} title="Diagrama lógico com escala de tempo" onClick={() => setLayout({ tsld: !layout.tsld })} disabled={none} />
        <span className="tsep" />
        <IconBtn Icon={Columns3} title="Colunas" onClick={() => P.open("columns")} disabled={none} />
        <IconBtn Icon={Filter} title="Filtros" onClick={() => P.open("filters")} disabled={none} />
        <IconBtn Icon={Layers} title="Agrupar e classificar" onClick={() => P.open("groupSort")} disabled={none} />
        <IconBtn Icon={ChartNoAxesGantt} title="Opções das barras do Gantt" onClick={() => P.open("bars")} disabled={none} />
        <IconBtn Icon={CalendarRange} title="Escala de tempo" onClick={() => P.open("timescale")} disabled={none} />
        <IconBtn Icon={ZoomIn} title="Aproximar" onClick={() => ganttCommand("zoom-in")} disabled={none} />
        <IconBtn Icon={ZoomOut} title="Afastar" onClick={() => ganttCommand("zoom-out")} disabled={none} />
        <IconBtn Icon={MoveHorizontal} title="Ajustar escala de tempo" onClick={() => ganttCommand("fit")} disabled={none} />
        <span className="tsep" />
        <IconBtn Icon={Calculator} title="Calcular cronograma (F9)" onClick={() => P.open("scheduleRun")} disabled={none} />
        <IconBtn Icon={BarChart3} title="Nivelar recursos (F10)" onClick={() => P.open("level")} disabled={none} />
        <IconBtn Icon={CalendarClock} title="Atualizar avanço" onClick={() => P.open("updateProgress")} disabled={none} />
        <IconBtn Icon={Wand2} title="Alteração em massa" onClick={() => P.open("globalChange")} disabled={none} />
        <IconBtn Icon={Flag} title="Gerenciar linhas de base" onClick={() => P.open("baselines")} disabled={none} />
        <IconBtn Icon={ClipboardCheck} title="Verificar cronograma" onClick={() => P.open("checkSchedule")} disabled={none} />
        <span className="tsep" />
        <IconBtn Icon={Highlighter} title="Destacar o próximo período de atualização" onClick={() => P.setSpotlight(!P.spotlight)} disabled={none} />
        <IconBtn Icon={GitBranch} title="Rastrear dependências" onClick={() => setLayout({ lower: layout.lower === "trace" ? "details" : "trace" })} disabled={none} />
        <IconBtn Icon={NotebookPen} title="Anotações" onClick={() => setLayout({ lower: "details", lowerTab: "notebook" })} disabled={none} />
        <IconBtn Icon={SlidersHorizontal} title="Detalhes do projeto" onClick={() => P.open("projectInfo")} disabled={none} />
        <span className="tsep" />
        {displays && <IconBtn Icon={MonitorUp} title="Monitores: abrir vistas em outras telas" onClick={() => displays.menu[0] && (displays.menu[0] as { onClick: () => void }).onClick()} />}
        <IconBtn Icon={LayoutDashboard} title="Relatórios e painéis" onClick={a.dashboards} />
        <IconBtn Icon={ChartLine} title="Planilha de uso de recursos" onClick={() => setLayout({ lower: "resourceUsage" })} disabled={none} />
        <IconBtn Icon={Search} title="Localizar (Ctrl+F)" onClick={find} disabled={none} />
        <IconBtn Icon={CircleHelp} title="Ajuda" onClick={a.help} />
        <span className="spacer" />
        <select className="p6-stock" value="" onChange={(e) => e.target.value && useLayout.getState().open(STOCK_LAYOUTS.find((l) => l.name === e.target.value)!)} title="Layouts rápidos" disabled={none}>
          <option value="">Layout rápido…</option>
          {STOCK_LAYOUTS.map((l) => (
            <option key={l.name}>{l.name}</option>
          ))}
        </select>
      </div>
      {banners}
      <div className="p6-body">
        <DirectoryBar a={a} />
        <div className="p6-window">
          <div className="p6-wintabs">
            {tabs.map((t) => (
              <span key={t} className={`p6-wintab ${t === win ? "active" : ""}`} onClick={() => P.show(t)} role="tab" aria-selected={t === win}>
                {WINDOW_LABEL[t]}
                {tabs.length > 1 && (
                  <button
                    className="p6-tabx"
                    aria-label={`Close ${WINDOW_LABEL[t]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      P.closeTab(t);
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {windowBody}
        </div>
        <CommandBar a={a} />
      </div>
      <div className="cl-statusbar p6-status">
        <span>Portfólio: todos os projetos</span>
        <span>Modo de acesso: compartilhado</span>
        <DataDateInput label="Data de corte" />
        <span title={schedule?.baselineInfo ? `Assigned ${new Date(schedule.baselineInfo.assignedAt).toLocaleString()}: ${schedule.baselineInfo.matched} activities matched` : "Baseline dates as imported"}>
          Linha de base: {schedule?.baselineInfo ? `${schedule.baselineInfo.name} (DD ${fmtDate(schedule.baselineInfo.dataDate)})` : "Project Baseline"}
        </span>
        <span>Usuário: {user?.name ?? "Local user"}</span>
        <span>DB: {a.dbLabel}</span>
        <span className="spacer" />
        <span className="cl-msg">{status}</span>
      </div>
      <P6Dialogs onSchedule={a.schedule} onAssignFile={a.assignBaseline} displays={displays?.dialog} />
      <ContextMenuHost />
    </div>
  );
}

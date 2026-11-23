import type * as THREE from "three";
import { syncShared } from "./shared";
import { recalcAssignmentCosts } from "../core/ops";
import { useP6 } from "./p6/commands";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scheduleCpm, ScheduleLoopError } from "../core/cpm";
import { SAMPLE_ORDER, SAMPLES, sampleKindOf, sampleProject, type SampleKind } from "../core/samples";
import { expandElements, motionAt } from "../core/motion";
import { parseMspdi } from "../core/mspdi";
import { writeMspdi } from "../core/mspdiWrite";
import { EMPTY_PRESENTATION, EMPTY_VIEW, type CameraState } from "../core/presentation";
import { normalizeProject, parseProject, PROJECT_FORMAT, PROJECT_VERSION, type ModelManifest, type ProjectModel, type ProjectRevision, type RevisionSource, type StratumProject } from "../core/project";
import { DEFAULT_PROFILES } from "../core/profiles";
import { computeStates, DEFAULT_SIM_OPTIONS, scheduleRange } from "../core/simulation";
import type { Schedule } from "../core/types";
import { applyScheduleRevision, planScheduleRevision, sameScheduleIdentity } from "../core/update";
import { decodeXer, listXerProjects, parseXerTables, xerToSchedule } from "../core/xer";
import { exportCsv, exportXer } from "../core/xerExport";
import { Viewer } from "../viewer/Viewer";
import { DEMO_SESSIONS, demoSession, demoStoreKind } from "../backend/demo";
import { MESH_FORMATS } from "../viewer/meshLoader";
import { combineModelParts, disposeModelParts, loadModelPart, restoreModelParts, type ModelPart } from "../viewer/projectModels";
import { modelHash, saveModelAsset } from "../backend/modelAssets";
import { readCheckpoint, saveCheckpoint } from "../backend/revisionHistory";
import { compareModelRevision } from "../viewer/modelRevision";
import { Present } from "./Present";
import { Teardown, teardownHud } from "./Teardown";
import { reportRoute, useConfig } from "../backend/config";
import { ConflictError } from "../backend/types";
import { uid, type P6Connection } from "../core/reporting";
import { DashboardsView } from "./Dashboards";
import { isCombined } from "../core/multiproject";
import { saveCombined } from "./p6/EnterpriseProjects";
import { ProjectsDialog } from "./ProjectsDialog";
import { RevisionDialog, RevisionHistory, type RevisionOffer } from "./RevisionDialog";
import { ReportView } from "./ReportView";
import { SettingsDialog } from "./SettingsDialog";
import { SetupWizard } from "./SetupWizard";
import { useTerms } from "./terms";
import { useAppearance } from "./appearance";
import { levelResources } from "../core/level";
import { scheduleLog } from "../core/scheduleLog";
import { DisplaysButton, DisplaysDialog, useDisplays } from "./display/Displays";
import { startSync } from "./display/sync";
import { ModeSwitch, ThemeButton } from "./ModeSwitch";
import { MspScreen, P6Screen, type ClassicActions } from "./ClassicLayouts";
import {
  Box,
  Calculator,
  ChevronDown,
  CircleHelp,
  CloudUpload,
  Database,
  Download,
  FileUp,
  FolderOpen,
  LayoutDashboard,
  Maximize,
  Menu,
  Save,
  Settings,
  Sparkles,
  Square,
  Video,
} from "lucide-react";
import { ActivityEditor } from "./ActivityEditor";
import { clearAutosave, loadAutosave, startAutosave } from "./autosave";
import { CostPanel, QuantityPanel, ResourcePanel } from "./Analysis";
import { download, downloadDataUrl, isNativeApp, pickFile } from "./files";
import { Gantt } from "./Gantt";
import { Help } from "./Help";
import { SidePanel } from "./SidePanel";
import { fmtDate, useStore, type LeftTab } from "./store";
import { Timeline } from "./Timeline";
import { assignBaseline } from "../core/baseline";
import { registerTrainingBridge } from "./training/engine";
import { TrainingButton, TrainingLayer } from "./training/Training";

const LEFT_TABS: { id: LeftTab; label: string }[] = [
  { id: "gantt", label: "Gantt" },
  { id: "activity", label: "Activity" },
  { id: "cost", label: "Cost & EVM" },
  { id: "resources", label: "Resources" },
  { id: "quantities", label: "Quantities" },
];

/** Built-in sample projects (see core/samples). The model name tells a saved project which one to rebuild. */
type DemoKind = SampleKind;
const demoKindOf = sampleKindOf;

/** Report pages (#report=…) render alone, for PDF printing; everything else is the workspace. */
export function App() {
  const route = useMemo(() => reportRoute(), []);
  if (route) return <ReportView dashboardId={route.dashboardId} projectId={route.projectId} backend={route.backend} />;
  return <Workspace />;
}


function Workspace() {
  const viewerRef = useRef<Viewer | null>(null);
  const { config, backend } = useConfig();
  const mode = config.mode;
  const t = useTerms();
  const theme = useAppearance();
  // Share the open project with display windows on other monitors.
  useEffect(() => {
    const h = startSync({ host: true });
    return () => h?.stop();
  }, []);
  const [settingsTab, setSettingsTab] = useState<null | "interface" | "data" | "p6" | "email" | "users">(null);
  const [projectsTab, setProjectsTab] = useState<null | "database" | "p6">(null);
  /** Model objects as loaded (before splitting into segments). */
  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const partsRef = useRef(new Map<string, ModelPart>());
  const projectAction = useRef(0);
  const cameraRef = useRef<CameraState>();
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [restore, setRestore] = useState<StratumProject | null>(null);
  const [revisionOffer, setRevisionOffer] = useState<{ review: RevisionOffer; finish: (value: Map<string, string> | null) => void } | null>(null);
  const finishReview = useRef<(value: Map<string, string> | null) => void>();
  const [showHistory, setShowHistory] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (!config.configured || DEMO_SESSIONS || mode !== "4d") return;
    let active = true;
    void backend.listProjects().then((projects) => {
      if (active && !useStore.getState().projectKey && projects.some((p) => !p.archived)) setProjectsTab("database");
    }).catch(() => {});
    return () => { active = false; };
  }, [backend, config.configured, mode]);

  // Offer to restore the last autosaved session, then keep autosaving.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let active = true;
    // The demo starts every session from the samples, so it has nothing to restore.
    if (DEMO_SESSIONS) return;
    loadAutosave().then((p) => {
      if (!active) return;
      if (p) setRestore(p);
      stop = startAutosave(currentPayload, setSavedAt);
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
  const store = useStore();
  const { schedule, elements, links, profiles, time, sim, selectedElements, status, busy, segments, paths, pathDraft, leftTab, scheduleDirty, currentProjectId, currentVersion } = store;

  // One viewer for the session, created the first time a layout shows a 3D view
  // (only the 4D layout does). A model loaded before then is handed over here.
  const [viewerGen, setViewerGen] = useState(0);
  const [viewportHost, setViewportHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!viewportHost) return;
    if (!viewerRef.current) {
      const v = new Viewer(viewportHost);
      viewerRef.current = v;
      v.setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
      if (objectsRef.current.size) {
        v.setObjects(objectsRef.current, useStore.getState().segments, true);
        v.setSelection(useStore.getState().selectedElements);
      }
      if (cameraRef.current) v.setCamera(cameraRef.current);
      setViewerGen((g) => g + 1);
    } else viewerRef.current.attach(viewportHost);
  }, [viewportHost]);
  useEffect(() => () => {
    viewerRef.current?.dispose();
    viewerRef.current = null;
  }, []);
  const getViewer = useCallback(() => viewerRef.current, []);
  useEffect(() => viewerRef.current?.setTheme(theme), [theme]);

  // Rebuild viewer objects when elements are split or unsplit.
  const segKey = useMemo(() => segments.map((s) => s.id).join(","), [segments]);
  useEffect(() => {
    if (!objectsRef.current.size) return;
    viewerRef.current?.setObjects(objectsRef.current, segments, false);
    viewerRef.current?.setSelection(useStore.getState().selectedElements);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey]);

  const elementIds = useMemo(() => elements.map((e) => e.id), [elements]);

  // One 4D frame: states for every element plus equipment motion.
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (!schedule) return v.applyFrame(new Map(), new Map());
    v.applyFrame(computeStates(schedule, links, profiles, elementIds, time, sim), motionAt(schedule, paths, time, sim.dateSource));
  }, [schedule, links, profiles, elementIds, time, sim, paths, segKey, viewerGen]);

  useEffect(() => {
    viewerRef.current?.setSelection(selectedElements);
  }, [selectedElements]);

  useEffect(() => {
    viewerRef.current?.setPathOverlay(sim.showPaths === false && !pathDraft ? [] : paths, pathDraft ?? []);
  }, [paths, pathDraft, sim.showPaths, viewerGen]);

  const runSchedule = () => {
    const s = useStore.getState();
    if (!s.schedule) return;
    try {
      const prevFinish = scheduleRange(s.schedule)?.finish ?? null;
      const r = scheduleCpm(s.schedule);
      // Schedule Options → "Level resources during scheduling".
      if (s.schedule.scheduleOptions?.recalcCosts) r.schedule = recalcAssignmentCosts(r.schedule).schedule;
      if (s.schedule.scheduleOptions?.levelWhenScheduling) {
        const lv = levelResources(r.schedule);
        r.schedule = lv.schedule;
        r.projectFinish = lv.projectFinish;
        r.warnings.push(...lv.warnings);
      }
      s.setSchedule(r.schedule, { keepTime: true });
      s.setScheduleReport({
        at: Date.now(),
        projectFinish: r.projectFinish,
        previousFinish: prevFinish,
        criticalCount: r.criticalPath.length,
        warnings: r.warnings,
        log: scheduleLog(r.schedule, r.warnings),
      });
      const shift = prevFinish !== null ? Math.round((r.projectFinish - prevFinish) / 86_400_000) : 0;
      s.setStatus(
        `Scheduled: finish ${fmtDate(r.projectFinish)}${shift ? ` (${shift > 0 ? "+" : ""}${shift}d)` : ""}, ` +
          `${r.criticalPath.length} critical activities, ${r.warnings.length} warning(s). See the Check tab.`,
      );
    } catch (err) {
      const msg = err instanceof ScheduleLoopError ? err.message : `Scheduling failed: ${(err as Error).message}`;
      s.setScheduleReport({ at: Date.now(), projectFinish: 0, previousFinish: null, criticalCount: 0, warnings: [], error: msg });
      s.setStatus(msg);
      s.setSideTab("check");
    }
  };

  // Schedule Options → "Schedule automatically": reschedule shortly after any edit.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = useStore.subscribe((st, prev) => {
      if (!st.scheduleDirty || st.schedule === prev.schedule || !st.schedule?.scheduleOptions?.autoSchedule) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        if (useStore.getState().scheduleDirty) runSchedule();
      }, 700);
    });
    return () => {
      unsub();
      if (t) clearTimeout(t);
    };
  }, []);

  // Shared enterprise data (EPS, portfolios, project codes) follows the store, e.g. a cloud folder.
  useEffect(() => {
    void syncShared(backend);
  }, [backend]);

  // Help buttons in the P6 dialogs open the help panel.
  useEffect(() => {
    const on = () => setHelpOpen(true);
    window.addEventListener("stratum:help", on);
    return () => window.removeEventListener("stratum:help", on);
  }, []);

  // Keyboard: Space play/pause, arrows step, Home/End, F9 schedule, ? help, Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === "F9") {
        e.preventDefault();
        // P6 layout: F9 opens the Schedule dialog, as in P6.
        if (useConfig.getState().config.mode === "p6" && useStore.getState().schedule) return useP6.getState().open("scheduleRun");
        return runSchedule();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (s.schedule || s.projectKey || s.models?.files.length) void saveRef.current(false).catch(() => {});
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "?") return setHelpOpen((h) => !h);
      if (e.key === "Escape") {
        setHelpOpen(false);
        if (s.pathDraft) s.setPathDraft(null);
        return;
      }
      if (!s.schedule) return;
      const r = scheduleRange(s.schedule, s.sim.dateSource);
      if (!r) return;
      const clamp = (t: number) => Math.min(r.finish, Math.max(r.start, t));
      if (e.code === "Space") {
        e.preventDefault();
        s.setPlaying(!s.playing);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        s.setTime(clamp(s.time + dir * (e.shiftKey ? 7 : 1) * 86_400_000));
      } else if (e.key === "Home") s.setTime(r.start);
      else if (e.key === "End") s.setTime(r.finish);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveRef = useRef<(asNew: boolean) => Promise<void>>(async () => {});

  // Desktop app: files double-clicked in Explorer/Finder arrive here.
  const openers = useRef({ importScheduleBytes: async (_n: string, _b: Uint8Array) => {}, importIfcBytes: async (_n: string, _b: Uint8Array) => {} });
  useEffect(() => {
    const bridge = window.stratumDesktop;
    if (!bridge) return;
    return bridge.onOpenFile(({ name, bytes }) => {
      if (/\.(xer|xml)$/i.test(name)) openers.current.importScheduleBytes(name, bytes);
      else if (/\.ifc$/i.test(name) || MESH_FORMATS.test(name)) openers.current.importIfcBytes(name, bytes);
    });
  }, []);

  const onViewportClick = (e: React.MouseEvent) => {
    const v = viewerRef.current;
    if (!v) return;
    const s = useStore.getState();
    if (s.pathDraft) {
      const p = v.pickPoint(e.clientX, e.clientY);
      if (p) s.setPathDraft([...s.pathDraft, [Math.round(p[0] * 100) / 100, 0, Math.round(p[2] * 100) / 100]]);
      return;
    }
    const id = v.pick(e.clientX, e.clientY);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const next = new Set(additive ? selectedElements : []);
    if (id) {
      if (additive && next.has(id)) next.delete(id);
      else next.add(id);
    }
    store.selectElements(next);
  };

  // Distinguish a click from an orbit drag.
  const down = useRef<{ x: number; y: number } | null>(null);

  const importSchedule = async (update = false) => {
    const workspace = useStore.getState().workspaceRevision;
    const f = await pickFile(".xer,.xml");
    if (!f) return;
    const buffer = await f.arrayBuffer();
    if (workspace === useStore.getState().workspaceRevision) await importScheduleBytes(f.name, new Uint8Array(buffer), update);
  };

  /** Read an XER / MS Project XML file into a schedule (first project, or the one the user picks). */
  const readScheduleFile = (name: string, bytes: Uint8Array): Schedule | null => {
    const head = new TextDecoder().decode(bytes.subarray(0, 400)).trimStart();
    if (/\.xml$/i.test(name) || head.startsWith("<")) return parseMspdi(new TextDecoder().decode(bytes));
    const tables = parseXerTables(decodeXer(bytes));
    const projects = listXerProjects(tables);
    let projectId = projects[0]?.id;
    if (projects.length > 1) {
      const pick = window.prompt(`This XER has ${projects.length} projects. Enter the number to use:\n` + projects.map((p, i) => `${i + 1}. ${p.code} – ${p.name}`).join("\n"), "1");
      const idx = Number(pick) - 1;
      if (!projects[idx]) return null;
      projectId = projects[idx].id;
    }
    return xerToSchedule(tables, { projectId });
  };

  /** P6 "Assign Baselines": take baseline dates from an approved-baseline XER or XML, matched by Activity ID. */
  const assignBaselineFromFile = async () => {
    const original = useStore.getState();
    const cur = original.schedule;
    if (!cur) return store.setStatus("Open the current schedule first, then assign its baseline.");
    const f = await pickFile(".xer,.xml");
    if (!f || original.workspaceRevision !== useStore.getState().workspaceRevision) return;
    try {
      store.setStatus(`Reading baseline ${f.name}…`, true);
      const bytes = await f.arrayBuffer();
      const latest = useStore.getState();
      if (latest.workspaceRevision !== original.workspaceRevision) return;
      if (latest.schedule !== cur) return store.setStatus("O cronograma mudou enquanto a baseline era lida. Selecione a baseline novamente.");
      const bl = readScheduleFile(f.name, new Uint8Array(bytes));
      if (!bl) return store.setStatus("Baseline not assigned.");
      const r = assignBaseline(cur, bl, `${bl.projectCode} – ${bl.projectName}`);
      if (!r.matched) return store.setStatus(`No Activity IDs in ${f.name} match the open project; baseline not assigned.`);
      store.setSchedule(r.schedule, { keepTime: true, dirty: false });
      store.setStatus(
        `Baseline assigned from ${bl.projectCode} (data date ${fmtDate(bl.dataDate)}): ${r.matched} activities matched` +
          (r.missing.length ? `, ${r.missing.length} added since the baseline have no baseline dates` : "") +
          (r.dropped.length ? `, ${r.dropped.length} baseline activities no longer exist` : "") +
          ". Commit to keep it.",
      );
    } catch (err) {
      if (original.workspaceRevision === useStore.getState().workspaceRevision) store.setStatus(`Baseline import failed: ${(err as Error).message}`);
    }
  };

  const reviewRevision = (review: RevisionOffer) => new Promise<Map<string, string> | null>((resolve) => {
    finishReview.current?.(null);
    const finish = (value: Map<string, string> | null) => {
      finishReview.current = undefined;
      setRevisionOffer(null);
      resolve(value);
    };
    finishReview.current = finish;
    setRevisionOffer({
      review,
      finish,
    });
  });

  const recordRevision = async (kind: ProjectRevision["kind"], source: RevisionSource, before: StratumProject, summary: string, dataDate: number | null, number?: number): Promise<ProjectRevision> => ({
    id: crypto.randomUUID(),
    kind,
    date: new Date().toISOString(),
    author: useConfig.getState().backend.user?.name || "Usuário local",
    source,
    dataDate,
    number,
    checkpoint: await saveCheckpoint(before),
    summary,
  });

  const importScheduleBytes = async (name: string, bytes: Uint8Array, update = false) => {
    const request = ++projectAction.current;
    try {
      store.setStatus(`Lendo ${name}…`, true);
      const schedule = readScheduleFile(name, bytes);
      if (!schedule) return store.setStatus("Importação cancelada.");
      const file = new Blob([new Uint8Array(bytes)]);
      const source = { name, hash: await modelHash(await file.arrayBuffer()) };
      if (request !== projectAction.current) return;
      await adoptSchedule(schedule, source, request, update, file);
    } catch (err) {
      if (request === projectAction.current) store.setStatus(`Falha na revisão ou importação. ${(err as Error).message}`);
    }
  };

  const adoptSchedule = async (schedule: Schedule, source: RevisionSource, request: number, update = false, file?: Blob) => {
    const st = useStore.getState();
    const prev = st.schedule;
    const sameProject = prev && sameScheduleIdentity(prev, schedule);
    if (update || sameProject) {
      if (!prev) throw new Error("Importe o primeiro cronograma antes de atualizar.");
      const plan = planScheduleRevision(prev, schedule);
      const imported = new Map(schedule.activities.map((a) => [a.code, a.id]));
      const linked = new Map<string, number>();
      for (const link of st.links) linked.set(link.activityId, (linked.get(link.activityId) ?? 0) + 1);
      const diff = plan.diff;
      const manual = await reviewRevision({
        title: "Prévia da revisão de cronograma",
        file: source.name,
        summary: [
          `${plan.matches.size} atividade(s) correspondentes · ${diff.added.length} adicionada(s) · ${diff.removed.length} removida(s) · ${diff.changed.length} alterada(s)`,
          `Corte ${fmtDate(diff.dataDateFrom)} → ${fmtDate(diff.dataDateTo)}`,
          `${st.links.filter((l) => plan.matches.has(l.activityId)).length} vínculo(s) com correspondência automática`,
          "A baseline, os IFCs e as vistas salvas serão preservados.",
        ],
        warnings: [
          ...(plan.ambiguous.size ? [`${plan.ambiguous.size} atividade(s) com identidade ambígua. Confira as correspondências manuais.`] : []),
          ...(diff.calendarsChanged ? ["Calendários alterados."] : []),
          ...(diff.relationshipsChanged ? ["Relações entre atividades alteradas."] : []),
          ...(diff.removed.length && diff.added.length ? ["Confira possíveis renumerações, divisões ou fusões entre atividades removidas e adicionadas."] : []),
        ],
        changes: [
          { title: "Atividades adicionadas", items: diff.added.map((a) => `${a.code} · ${a.name}`) },
          { title: "Atividades removidas", items: diff.removed.map((a) => `${a.code} · ${a.name}`) },
          { title: "Atividades alteradas", items: diff.changed.map((a) => `${a.code} · ${a.name} · ${a.fields.join(", ")}`) },
        ],
        mappings: prev.activities.filter((a) => !plan.matches.has(a.id)).map((a) => ({
          id: a.id, label: `${a.code} · ${a.name}${plan.ambiguous.has(a.id) ? " (ambígua)" : ""}`, links: linked.get(a.id) ?? 0,
        })),
        destinations: imported,
        occupied: new Set(plan.matches.values()),
        destinationLabel: "o código da atividade",
      });
      if (request !== projectAction.current) return;
      if (!manual) return store.setStatus("Revisão de cronograma cancelada. A obra ficou na versão anterior.");
      const before = currentPayload();
      if (prev !== before.schedule) throw new Error("O cronograma mudou durante a prévia. Abra a revisão novamente.");
      const mapping = new Map([...plan.matches, ...manual]);
      const result = applyScheduleRevision(prev, schedule, before.links, before.paths ?? [], mapping);
      const summary = `${result.links.length} vínculo(s) mantido(s) e ${result.orphaned.length} sem correspondência.`;
      if (file && source.hash) await saveModelAsset(source.hash, file);
      const number = (before.revisions?.filter((entry) => entry.kind === "schedule").length ?? 0) + 2;
      const entry = await recordRevision("schedule", source, before, summary, schedule.dataDate, number);
      if (request !== projectAction.current) return;
      if (prev !== useStore.getState().schedule || before.links !== useStore.getState().links || before.paths !== useStore.getState().paths) {
        throw new Error("A obra mudou durante a revisão. Abra a prévia novamente.");
      }
      useStore.setState({
        schedule: result.schedule, scheduleSource: source, scheduleDirty: false, past: [], future: [],
        links: result.links, paths: result.paths, selectedActivity: null, selectedActivities: new Set(), collapsedWbs: new Set(),
        revisions: [...(before.revisions ?? []), entry], playing: false, scheduleReport: null,
        lastUpdate: { ...diff, keptLinks: result.links.length, droppedLinks: result.orphaned.length, at: Date.now() },
        sideTab: "check",
      });
      store.setStatus(`Revisão de cronograma aplicada. ${summary}`);
      return;
    }
    if (prev && !window.confirm(`Abrir ${schedule.projectCode} como nova obra? Salve a obra atual antes de trocar.`)) {
      return store.setStatus("Importação cancelada.");
    }
    if (file && source.hash) {
      try {
        await saveModelAsset(source.hash, file);
      } catch {
        // An initial import can still work in memory. Revisions require a checkpoint.
        source = { name: source.name };
      }
    }
    if (request !== projectAction.current) return;
    if (prev) applyProject({ ...emptyProject(), schedule, scheduleSource: source });
    else {
      store.setSchedule(schedule);
      useStore.setState({ scheduleSource: source, projectKey: st.projectKey ?? crypto.randomUUID() });
    }
    const label = schedule.sourceFormat === "mspdi" ? "MS Project" : schedule.sourceFormat === "p6-eppm" ? "P6 EPPM" : "P6";
    store.setStatus(`Imported ${schedule.projectCode} (${label}): ${schedule.activities.length} activities, ${schedule.relationships.length} relationships. Data date ${fmtDate(schedule.dataDate)}.`);
  };

  // ---- database
  function currentPayload(): StratumProject {
    const st = useStore.getState();
    return {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      savedAt: new Date().toISOString(),
      modelFileName: st.modelFileName,
      projectKey: st.projectKey ?? undefined,
      title: st.projectTitle ?? undefined,
      archived: st.projectArchived || undefined,
      models: st.models,
      scheduleSource: st.scheduleSource,
      revisions: st.revisions,
      simulation: st.sim,
      view: {
        camera: viewerRef.current?.getCamera() ?? cameraRef.current,
        settings: {
          ...st.view3d,
          sectionBounds: st.view3d.sectionBounds ??
            (st.view3d.cuts.some((cut) => cut.on) || st.view3d.box?.on ? viewerRef.current?.getSectionBounds() : undefined),
        },
        time: st.time,
      },
      schedule: st.schedule,
      links: st.links,
      rules: st.rules,
      profiles: st.profiles,
      segments: st.segments,
      groups: st.groups,
      paths: st.paths,
      presentation: st.presentation,
    };
  }

  const emptyProject = (title?: string): StratumProject => ({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: "",
    projectKey: crypto.randomUUID(),
    title,
    modelFileName: null,
    schedule: null,
    links: [],
    rules: [],
    profiles: structuredClone(DEFAULT_PROFILES),
  });

  const saveToDb = async (asNew = false) => {
    const st = useStore.getState();
    if (!st.schedule && !st.projectKey && !st.models?.files.length) return;
    if (st.schedule && isCombined(st.schedule) && !asNew) {
      st.setStatus(await saveCombined());
      return;
    }
    const id = asNew || !st.currentProjectId ? uid("prj") : st.currentProjectId;
    const request = projectAction.current;
    const payload = currentPayload();
    payload.projectKey = asNew && st.currentProjectId ? crypto.randomUUID() : st.projectKey ?? id;
    if (asNew) delete payload.archived;
    try {
      const v = await useConfig.getState().backend.saveProject(id, payload, asNew || !st.currentProjectId ? undefined : st.currentVersion ?? undefined);
      if (request !== projectAction.current) return;
      useStore.setState({ currentProjectId: id, currentVersion: v, projectKey: payload.projectKey, projectArchived: !!payload.archived });
      st.setStatus(`Projeto ${payload.title ?? st.schedule?.projectCode ?? id} salvo (versão ${v}).`);
    } catch (e) {
      if (request !== projectAction.current) throw e;
      if (e instanceof ConflictError) {
        st.setStatus(`Not saved: ${e.message}`);
        throw new Error(`${e.message} Use "Save as new" to keep your version, or reopen the project.`);
      }
      st.setStatus(`Save failed: ${(e as Error).message}`);
      throw e;
    }
  };

  const openFromDb = async (id: string) => {
    const request = ++projectAction.current;
    const r = await useConfig.getState().backend.getProject(id);
    if (!r) throw new Error("Project not found");
    if (request === projectAction.current) await restoreProject(normalizeProject(r.project), request, id, r.version);
  };

  const importFromP6 = (s: Schedule, c: P6Connection) => {
    const request = ++projectAction.current;
    void adoptSchedule(s, { name: c.name }, request).catch((error) => {
      if (request === projectAction.current) store.setStatus((error as Error).message);
    });
  };

  const pushToP6 = async () => {
    const s = useStore.getState().schedule;
    if (!s?.p6Source) return;
    if (!window.confirm(`Send progress (actual dates, % complete, remaining duration) for ${s.projectCode} back to P6?`)) return;
    try {
      const r = await useConfig.getState().backend.p6Push(s.p6Source.connectionId, s);
      if (r.pendingApproval) {
        store.setStatus(`Sent for approval: an admin reviews the change in Settings > Security before it goes to P6.`);
        return;
      }
      store.setStatus(`Sent progress for ${r.updated} activities to P6.${r.skipped.length ? ` Not sent (new in Stratum, use XER): ${r.skipped.slice(0, 8).join(", ")}${r.skipped.length > 8 ? "…" : ""}.` : ""} Reschedule in P6 (F9).`);
    } catch (e) {
      store.setStatus(`P6 update failed: ${(e as Error).message}`);
    }
  };

  const importIfc = async (target?: ProjectModel, revision = false) => {
    const workspace = useStore.getState().workspaceRevision;
    const f = await pickFile(".ifc,.glb,.gltf,.obj,.stl,.fbx");
    if (f && workspace === useStore.getState().workspaceRevision) await importModel(f.name, f, target, revision);
  };

  const loadObjects = (objects: Map<string, THREE.Object3D>, fit = true) => {
    const previous = objectsRef.current;
    objectsRef.current = objects;
    viewerRef.current?.setObjects(objects, useStore.getState().segments, fit);
    disposeModelParts([{ objects: new Map([...previous].filter(([id, object]) => objects.get(id) !== object)) }]);
  };

  const commitModels = (manifest: ModelManifest, parts: Map<string, ModelPart>, lost = new Set<string>(), mapping = new Map<string, string>(), entry?: ProjectRevision) => {
    const st = useStore.getState();
    const combined = combineModelParts(parts.values());
    const fit = !objectsRef.current.size || !!demoKindOf(st.modelFileName);
    partsRef.current = parts;
    const key = (id: string) => mapping.get(id) ?? id;
    const remap = (ids: string[]) => [...new Set(ids.filter((id) => !lost.has(id)).map(key))];
    const segments = st.segments.filter((s) => !lost.has(s.id) && !lost.has(s.parentId)).map((s) => ({ ...s, parentId: key(s.parentId) }));
    const groups = st.groups.map((g) => ({ ...g, elementIds: remap(g.elementIds) }));
    useStore.setState({
      baseElements: combined.elements, elements: expandElements(combined.elements, segments, groups),
      modelFileName: manifest.files[0]?.name ?? null, models: manifest, segments, groups,
      paths: st.paths.map((p) => ({ ...p, elementIds: remap(p.elementIds) })),
      links: st.links.filter((l) => !lost.has(l.elementId)).map((l) => ({ ...l, elementId: key(l.elementId) })),
      revisions: entry ? [...(st.revisions ?? []), entry] : st.revisions,
      selectedElements: new Set(), projectKey: st.projectKey ?? crypto.randomUUID(), pathDraft: null,
    });
    loadObjects(combined.objects, fit);
    if (fit && cameraRef.current) viewerRef.current?.setCamera(cameraRef.current);
  };

  const previewModelRevision = async (target: ProjectModel, model: ProjectModel, part: ModelPart) => {
    const previous = partsRef.current.get(target.id);
    if (!previous || !target.hash) throw new Error("Localize o modelo atual antes de substituir a revisão.");
    const diff = compareModelRevision(previous, part);
    const st = useStore.getState();
    const unmatched = new Set(diff.removed.map((e) => e.id));
    const targets = new Map(diff.added.filter((e) => !/(?:^|:)express-\d+$/.test(e.id)).map((e) =>
      [e.properties.GlobalId ?? e.id, e.id],
    ));
    const parents = new Map(st.segments.map((s) => [s.id, s.parentId]));
    const base = (id: string) => parents.get(id) ?? id;
    const counts = new Map<string, number>();
    const referenced = new Set([
      ...st.links.map((l) => base(l.elementId)), ...st.groups.flatMap((g) => g.elementIds.map(base)),
      ...st.paths.flatMap((p) => p.elementIds.map(base)), ...st.segments.map((s) => s.parentId),
    ]);
    for (const l of st.links) counts.set(base(l.elementId), (counts.get(base(l.elementId)) ?? 0) + 1);
    const choice = await reviewRevision({
      title: "Prévia da revisão de modelo",
      file: model.name,
      summary: [
        `${diff.matched} identificador(es) compatível(is), ${diff.added.length} novo(s), ${diff.removed.length} removido(s), ${diff.changed.length} alterado(s).`,
        `${st.links.length - diff.removed.reduce((total, e) => total + (counts.get(e.id) ?? 0), 0)} vínculo(s) mantido(s) automaticamente.`,
        "A câmera e as vistas existentes serão mantidas.",
      ],
      warnings: [
        ...(diff.georeferenceChanged ? ["A referência geográfica do IFC mudou. Confira o alinhamento com os demais modelos antes de aplicar."] : []),
        ...(diff.translated ? ["Vários elementos mudaram de posição na mesma direção. Confira a origem compartilhada do IFC."] : []),
        ...(diff.added.length && diff.removed.length ? ["Confira possíveis mudanças de GlobalId, divisões ou fusões. Nenhuma correspondência será deduzida pelo nome."] : []),
      ],
      changes: [
        { title: "Elementos adicionados", items: diff.added.map((e) => `${e.name} · ${e.properties.GlobalId ?? e.id}`) },
        { title: "Elementos removidos ou sem identidade estável", items: diff.removed.map((e) => `${e.name} · ${e.properties.GlobalId ?? e.id}`) },
        { title: "Elementos alterados", items: diff.changed.map((e) => `${e.label} · ${e.fields.join(", ")}`) },
      ],
      mappings: diff.removed.filter((e) => referenced.has(e.id)).map((e) => ({ id: e.id, label: e.name, links: counts.get(e.id) ?? 0 })),
      destinations: targets,
      destinationLabel: "o GlobalId do elemento",
    });
    if (!choice) return null;
    const lost = new Set<string>([...unmatched].filter((id) => !choice.has(id)));
    for (const segment of st.segments) if (lost.has(segment.parentId)) lost.add(segment.id);
    const dropped = st.links.filter((l) => lost.has(l.elementId)).length;
    return { choice, lost, summary: `${diff.changed.length} elemento(s) alterado(s), ${choice.size} remapeado(s) e ${dropped} vínculo(s) sem correspondência.` };
  };

  const confirmModelChange = (target: ProjectModel | undefined, next?: ModelPart) => {
    const st = useStore.getState();
    const before = target ? partsRef.current.get(target.id) : undefined;
    const oldIds = new Set(before?.elements.map((e) => e.id) ?? []);
    const nextIds = new Set(next?.elements.map((e) => e.id));
    const segmented = new Map(st.segments.map((s) => [s.id, s.parentId]));
    const referenced = new Set([
      ...st.links.map((l) => l.elementId), ...st.groups.flatMap((g) => g.elementIds),
      ...st.paths.flatMap((p) => p.elementIds), ...st.segments.map((s) => s.parentId),
    ]);
    const lost = new Set<string>();
    for (const id of referenced) {
      const key = segmented.get(id) ?? id;
      const belongs = target ? (before ? oldIds.has(key) : target.id ? key.startsWith(`${target.id}:`) : !key.includes(":")) : !!demoKindOf(st.modelFileName);
      if (belongs && (!nextIds.has(key) || /(?:^|:)express-\d+$/.test(key))) lost.add(id);
    }
    const dropped = st.links.filter((l) => lost.has(l.elementId)).length;
    if (target || lost.size) {
      const added = [...nextIds].filter((id) => !oldIds.has(id)).length;
      const text = next ? `${nextIds.size - added} identificador(es) compatível(is), ${added} novo(s).` : `Remover ${target?.name} da obra?`;
      if (!window.confirm(`${text}\n${dropped} vínculo(s) serão removidos e ${st.links.length - dropped} serão mantidos.\n${lost.size} referência(s) de elementos serão descartadas.`)) return null;
    }
    return lost;
  };

  const importModel = async (name: string, file: Blob, explicit?: ProjectModel, revision = false) => {
    const request = ++projectAction.current;
    let part: ModelPart | undefined;
    try {
      const current = useStore.getState().models ?? { files: [] };
      const sameName = current.files.filter((f) => !partsRef.current.has(f.id) && f.name.toLowerCase() === name.toLowerCase());
      const target = explicit ?? (sameName.length === 1 ? sameName[0] : undefined);
      store.setStatus(`Carregando ${name}…`, true);
      const buffer = await file.arrayBuffer();
      const hash = await modelHash(buffer);
      if (request !== projectAction.current) return;
      if (target?.hash && !revision && target.hash !== hash) throw new Error("O arquivo difere da versão salva. Para atualizar, use Substituir revisão.");
      if (revision && target?.hash === hash) return store.setStatus("O modelo selecionado é idêntico à revisão ativa.");
      if (target && /\.ifc$/i.test(target.name) !== /\.ifc$/i.test(name)) throw new Error("Selecione um arquivo do mesmo formato do original.");
      if (!target && current.files.some((f) => f.hash === hash)) {
        store.setStatus("Esse arquivo já está na obra.");
        return;
      }
      const model: ProjectModel = { id: target?.id ?? crypto.randomUUID(), name, hash, size: file.size, revision: (target?.revision ?? 1) + (revision ? 1 : 0) };
      part = await loadModelPart(model, buffer, current.coordination);
      if (request !== projectAction.current) return;
      if (target && !target.hash && !revision) {
        const modelIds = new Set(part.elements.map((e) => e.id));
        const st = useStore.getState();
        const segments = new Map(st.segments.map((s) => [s.id, s.parentId]));
        const match = st.links.filter((l) => modelIds.has(segments.get(l.elementId) ?? l.elementId)).length;
        if ((st.links.length > 0 || name.toLowerCase() !== target.name.toLowerCase()) && !window.confirm(
          `Vincular o arquivo ${name} ao modelo legado ${target.name}?\n${match} vínculo(s) correspondem aos identificadores IFC. Confirme que selecionou o arquivo original.`,
        )) {
          store.setStatus("Recuperação do IFC cancelada.");
          return;
        }
      }
      const before = currentPayload();
      const preview = revision && target ? await previewModelRevision(target, model, part) : undefined;
      if (request !== projectAction.current) return;
      const lost = revision ? preview?.lost : !target ? confirmModelChange(target, part) : new Set<string>();
      if (!lost) {
        store.setStatus("Importação cancelada. A versão anterior continua ativa.");
        return;
      }
      let stored = true;
      try {
        await saveModelAsset(hash, file);
      } catch (error) {
        if (revision) throw error;
        stored = false;
      }
      const entry = preview ? await recordRevision("ifc", { name, hash }, before, preview.summary, before.schedule?.dataDate ?? null, model.revision) : undefined;
      if (request !== projectAction.current) return;
      const active = useStore.getState();
      if (revision && (before.links !== active.links || before.models !== active.models || before.segments !== active.segments || before.paths !== active.paths || before.groups !== active.groups || before.schedule !== active.schedule)) {
        throw new Error("A obra mudou durante a prévia. Abra a revisão novamente.");
      }
      const parts = new Map(partsRef.current).set(model.id, part);
      const files = target ? current.files.map((f) => f.id === target.id ? model : f) : [...current.files, model];
      commitModels({ files, coordination: current.coordination ?? part.coordination }, parts, lost, preview?.choice, entry);
      if (entry && before.view?.settings.sectionBounds) useStore.getState().setView3d({ sectionBounds: before.view.settings.sectionBounds });
      part = undefined;
      store.setStatus(`Modelo ${name} carregado. ${parts.size} de ${files.length} modelo(s) na obra.${stored ? "" : " O armazenamento local falhou. Guarde o arquivo original para localizá-lo ao reabrir."}`);
    } catch (err) {
      if (request === projectAction.current) store.setStatus(`Falha ao carregar o modelo. ${(err as Error).message}`);
    } finally {
      if (part) disposeModelParts([part]);
    }
  };

  openers.current = {
    importScheduleBytes,
    importIfcBytes: (name, bytes) => importModel(name, new Blob([new Uint8Array(bytes)])),
  };
  saveRef.current = saveToDb;

  const removeModel = (model: ProjectModel) => {
    const manifest = useStore.getState().models;
    if (!manifest) return;
    const lost = confirmModelChange(model);
    if (!lost) return;
    ++projectAction.current;
    const parts = new Map(partsRef.current);
    parts.delete(model.id);
    commitModels({ ...manifest, files: manifest.files.filter((f) => f.id !== model.id) }, parts, lost);
    store.setStatus(`Modelo ${model.name} removido da obra.`);
  };

  const loadDemo = (kind: DemoKind = "gis") => {
    const d = SAMPLES[kind];
    const p = sampleProject(kind);
    const boxes = d.model();
    applyProject(p, new Map(), { elements: boxes.map((b) => b.element), objects: Viewer.demoObjects(boxes) });
    const acts = new Set(p.links.map((l) => l.activityId)).size;
    store.setStatus(`${d.done} ${boxes.length} elements linked to ${acts} activities, with costs and resources. Press Play, or F9 to reschedule.`);
  };

  const applyProject = (p: StratumProject, parts = new Map<string, ModelPart>(), scene = combineModelParts(parts.values()), id: string | null = null, version: number | null = null) => {
    ++projectAction.current;
    finishReview.current?.(null);
    partsRef.current = parts;
    cameraRef.current = p.view?.camera;
    viewerRef.current?.setPathOverlay([]);
    viewerRef.current?.setExplode(0, "storeys");
    viewerRef.current?.setCamera({ pos: [12, 9, 12], target: [0, 0, 0], fov: 45, up: [0, 1, 0], clipping: [0.1, 5000] });
    const projectSegments = p.segments ?? [];
    const groups = p.groups ?? [];
    const simulation = { ...DEFAULT_SIM_OPTIONS, ...p.simulation };
    const range = p.schedule ? scheduleRange(p.schedule, simulation.dateSource) : null;
    useStore.setState((st) => ({
      schedule: p.schedule, scheduleDirty: false, scheduleReport: null, lastUpdate: null, past: [], future: [],
      baseElements: scene.elements, elements: expandElements(scene.elements, projectSegments, groups),
      modelFileName: p.models?.files[0]?.name ?? p.modelFileName, segments: projectSegments, groups,
      links: p.links, rules: p.rules, profiles: p.profiles, paths: p.paths ?? [],
      presentation: p.presentation ?? EMPTY_PRESENTATION,
      selectedActivity: null, selectedActivities: new Set(), selectedElements: new Set(),
      models: p.models, projectKey: p.projectKey ?? id ?? (p.schedule || p.modelFileName ? crypto.randomUUID() : null),
      scheduleSource: p.scheduleSource, revisions: p.revisions,
      projectTitle: p.title ?? null, projectArchived: !!p.archived, currentProjectId: id, currentVersion: version,
      workspaceRevision: st.workspaceRevision + 1, pathDraft: null, clipboard: null, playing: false,
      collapsedWbs: new Set(), ganttFilter: { text: "", kind: "all" }, ganttTracking: false,
      time: Number.isFinite(p.view?.time) ? p.view!.time : p.schedule?.dataDate ?? range?.start ?? Date.now(),
      sim: simulation, view3d: { ...EMPTY_VIEW, ...p.view?.settings },
    }));
    loadObjects(scene.objects);
    if (cameraRef.current) viewerRef.current?.setCamera(cameraRef.current);
    setRestore(null);
    setShowHistory(false);
    setSavedAt(null);
  };

  const restoreProject = async (p: StratumProject, request: number, id: string | null = null, version: number | null = null, strict = false) => {
    const label = p.title ?? p.schedule?.projectCode ?? "sem nome";
    const sample = !p.models && demoKindOf(p.modelFileName);
    if (sample) {
      const boxes = SAMPLES[sample].model();
      applyProject(p, new Map(), { elements: boxes.map((b) => b.element), objects: Viewer.demoObjects(boxes) }, id, version);
      store.setStatus(`Projeto ${label} aberto com o modelo de exemplo.`);
      return;
    }
    const manifest = p.models ?? { files: p.modelFileName ? [{ id: "", name: p.modelFileName }] : [] };
    store.setStatus(`Abrindo ${label}…`, true);
    const result = await restoreModelParts(manifest, () => request === projectAction.current);
    if (request !== projectAction.current) {
      disposeModelParts(result.parts.values());
      return;
    }
    if (strict && result.missing.length) {
      disposeModelParts(result.parts.values());
      throw new Error(`Arquivos anteriores indisponíveis: ${result.missing.map((file) => file.name).join(", ")}. A obra atual foi preservada.`);
    }
    applyProject({ ...p, models: result.manifest }, result.parts, undefined, id, version);
    const missing = result.missing.map((f) => f.name);
    store.setStatus(`Projeto ${label} aberto. ${result.parts.size} modelo(s) e ${p.links.length} vínculo(s).${missing.length ? ` Use Modelos → Localizar arquivo para: ${missing.join(", ")}.` : ""}`);
  };

  const downloadRevision = async (entry: ProjectRevision) => {
    try {
      const previous = await readCheckpoint(entry.checkpoint);
      const name = previous.title ?? previous.schedule?.projectCode ?? "obra";
      download(`${name}-anterior.stratum.json`, JSON.stringify(previous, null, 2), "application/json");
    } catch (err) {
      store.setStatus((err as Error).message);
      setShowHistory(false);
    }
  };

  const restoreRevision = async (item: ProjectRevision) => {
    if (!window.confirm("Restaurar o estado anterior a esta revisão, incluindo cronograma, modelos, vínculos e vistas? O estado atual será guardado no histórico.")) return;
    const request = ++projectAction.current;
    const st = useStore.getState();
    const before = currentPayload();
    try {
      store.setStatus("Preparando o estado anterior…", true);
      const previous = await readCheckpoint(item.checkpoint);
      const entry = await recordRevision("restore", item.source, before, `Estado restaurado para antes de ${item.source.name}.`, previous.schedule?.dataDate ?? null);
      if (request !== projectAction.current) return;
      await restoreProject({
        ...previous, projectKey: before.projectKey, title: before.title, archived: before.archived,
        revisions: [...(before.revisions ?? []), entry],
      }, request, st.currentProjectId, st.currentVersion, true);
    } catch (err) {
      if (request === projectAction.current) {
        setShowHistory(false);
        store.setStatus(`A restauração não foi aplicada. ${(err as Error).message}`);
      }
    }
  };

  const saveProject = () => {
    const p = currentPayload();
    download(`${p.schedule?.projectCode ?? p.title ?? "projeto"}.stratum.json`, JSON.stringify(p, null, 2), "application/json");
    store.setStatus("Arquivo de projeto salvo. Os modelos ficam no armazenamento local.");
  };

  const openProject = async () => {
    const f = await pickFile(".json");
    if (!f) return;
    const request = ++projectAction.current;
    try {
      const p = parseProject(await f.text());
      if (request === projectAction.current) await restoreProject(p, request);
    } catch (err) {
      if (request === projectAction.current) store.setStatus(`Não foi possível abrir o projeto. ${(err as Error).message}`);
    }
  };

  const exportSchedule = (kind: "xer" | "csv" | "mspdi") => {
    const s = useStore.getState().schedule;
    if (!s) return;
    if (kind === "xer") {
      download(`${s.projectCode}-stratum.xer`, exportXer(s), "application/octet-stream");
      store.setStatus(
        s.sourceXer
          ? "XER exported. In P6 use File > Import > XER and choose 'Update Existing Project' to bring the dates back."
          : "XER exported as a new P6 project.",
      );
    } else if (kind === "mspdi") {
      download(`${s.projectCode}.xml`, writeMspdi(s), "application/xml");
      store.setStatus("Saved as Microsoft Project XML. In MS Project use File › Open, choose XML Format, and open it as a new project.");
    } else {
      download(`${s.projectCode}.csv`, exportCsv(s), "text/csv");
      store.setStatus("CSV exported.");
    }
  };

  const snapshot = () => {
    const v = viewerRef.current;
    if (!v) return;
    downloadDataUrl(`stratum-${new Date(time).toISOString().slice(0, 10)}.png`, v.snapshot());
  };

  const toggleRecording = () => {
    const v = viewerRef.current;
    if (!v || !schedule) return;
    if (recording) {
      recording.stop();
      return;
    }
    const range = scheduleRange(schedule, sim.dateSource);
    if (!range) return;
    // With the teardown panel open, the video carries it: the 3D frame and the panel are drawn together.
    let stream = v.canvas.captureStream(30);
    let stopComposite = () => {};
    if (teardownHud.canvas) {
      const gl = v.canvas;
      const out = document.createElement("canvas");
      out.width = gl.width;
      out.height = gl.height;
      const g = out.getContext("2d")!;
      let raf = 0;
      const draw = () => {
        g.drawImage(gl, 0, 0);
        const hud = teardownHud.canvas;
        if (hud) {
          const k = out.height / 900;
          const w = (hud.width / (window.devicePixelRatio || 1)) * k;
          const h = (hud.height / (window.devicePixelRatio || 1)) * k;
          g.drawImage(hud, out.width - w - 24 * k, out.height - h - 24 * k, w, h);
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
      stream = out.captureStream(30);
      stopComposite = () => cancelAnimationFrame(raf);
    }
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stopComposite();
      download(`${schedule.projectCode}-4d.webm`, new Blob(chunks, { type: "video/webm" }), "video/webm");
      setRecording(null);
      useStore.getState().setPlaying(false);
      store.setStatus("Video saved.");
    };
    const unsub = useStore.subscribe((s, prev) => {
      if (prev.playing && !s.playing) {
        unsub();
        if (rec.state === "recording") rec.stop();
      }
    });
    rec.start(250);
    setRecording(rec);
    store.setTime(range.start);
    store.setPlaying(true);
    store.setStatus("Recording 4D video… press Stop to finish early.");
  };

  // Web demo: a new session gets its own copy of every sample project, opens the
  // GIS substation and shows the P6 Projects window.
  const demoBoot = useRef(false);
  useEffect(() => {
    if (!DEMO_SESSIONS || demoBoot.current) return;
    demoBoot.current = true;
    (async () => {
      const be = useConfig.getState().backend;
      try {
        let list = await be.listProjects();
        if (demoSession.fresh || !list.length) {
          store.setStatus("Preparing your demo session with the sample projects…", true);
          for (const k of SAMPLE_ORDER) await be.saveProject(`demo-${k}`, sampleProject(k));
          list = await be.listProjects();
        }
        // A link like /demo/?project=road (from the website) opens that sample on the Activities view.
        const want = new URLSearchParams(location.search).get("project");
        const linked = want && list.some((p) => p.id === `demo-${want}`) ? `demo-${want}` : null;
        if (linked) await openFromDb(linked);
        else if (!useStore.getState().schedule && list.some((p) => p.id === "demo-gis")) await openFromDb("demo-gis");
        useP6.getState().show(linked ? "activities" : "projects");
        const where = (await demoStoreKind()) === "cloudflare" ? "on the demo server" : "in this browser";
        store.setStatus(`Demo session ready: ${list.length} sample projects, saved ${where}. Change, add or delete anything; sign out or open a new tab to start again with fresh samples.`);
      } catch (e) {
        store.setStatus(`Could not prepare the demo session: ${(e as Error).message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewport = (
    <div className="viewport-wrap">
      <Teardown key={`teardown-${store.workspaceRevision}`} getViewer={getViewer} gen={viewerGen} onRecord={toggleRecording} recording={!!recording} />
      <Present key={`present-${store.workspaceRevision}`} getViewer={getViewer} gen={viewerGen} />
      <div
        className={`viewport ${pathDraft ? "drawing" : ""}`}
        ref={setViewportHost}
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const d = down.current;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) onViewportClick(e);
          down.current = null;
        }}
      />
      {elements.length === 0 && (
        <div className="viewport-hint">
          <p>No model loaded. Try a sample project:</p>
          <button className="primary" onClick={() => loadDemo("gis")}>
            220 kV GIS substation (UAE)
          </button>
          <button className="link" onClick={() => loadDemo("rc")}>
            or a small RC building
          </button>
        </div>
      )}
    </div>
  );

  const canPush = !!schedule?.p6Source && schedule.p6Source.kind === "eppm";
  const dbLabel = backend.label;
  // Short form for the top bar; the full label is in the tooltip.
  const dbShort = DEMO_SESSIONS ? "Demo session" : backend.kind === "server" ? "Server" : backend.kind === "desktop" ? "Local database" : "This browser";

  // Buttons shared by every layout, so all three modes keep the same features.
  const I = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;
  const btn = {
    importSchedule: (
      <details className="menu">
        <summary className="tb" title="Cronograma da obra"><FileUp {...I} /> Cronograma <ChevronDown {...I} /></summary>
        <div className="menu-body" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute("open")}>
          <button disabled={busy} onClick={() => void importSchedule()}>Importar cronograma (XER / XML)…</button>
          <button disabled={busy || !schedule} onClick={() => void importSchedule(true)}>Atualizar cronograma…</button>
          <button disabled={!store.revisions?.length} onClick={() => setShowHistory(true)}>Histórico de revisões…</button>
        </div>
      </details>
    ),
    importIfc: (
      <details className="menu">
        <summary className="tb" title="Modelos da obra">
          <Box {...I} /> Modelos <ChevronDown {...I} />
        </summary>
        <div className="menu-body">
          <button disabled={busy} onClick={() => void importIfc()}>Adicionar modelo…</button>
          {store.models?.files.map((model) => (
            <div key={model.id} className="model-menu-entry">
              <b title={model.name}>{model.name}</b>
              <small>{partsRef.current.has(model.id) ? `Revisão ${model.revision ?? 1} · Carregado` : "Arquivo pendente"}</small>
              {!partsRef.current.has(model.id) && <button disabled={busy} onClick={() => void importIfc(model)}>Localizar arquivo…</button>}
              <button disabled={busy} onClick={() => void importIfc(model, true)}>Substituir revisão…</button>
              <button disabled={busy} onClick={() => removeModel(model)}>Remover da obra</button>
            </div>
          ))}
        </div>
      </details>
    ),
    run: (
      <button className={`tb ${scheduleDirty ? "primary" : ""}`} onClick={runSchedule} disabled={!schedule} title={`${t.schedule} using CPM (F9)`}>
        <Calculator {...I} />
        <span>{t.schedule}</span>
        <kbd>F9</kbd>
      </button>
    ),
    exportMenu: (
      <details className="menu">
        <summary className="tb collapse" title="Export">
          <Download {...I} />
          <span>Export</span>
          <ChevronDown size={13} aria-hidden className="chev" />
        </summary>
        <div className="menu-body" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute("open")}>
          <button onClick={() => exportSchedule("xer")} disabled={!schedule}>P6 XER</button>
          <button onClick={() => exportSchedule("csv")} disabled={!schedule}>CSV (Excel)</button>
          <button onClick={() => exportSchedule("mspdi")} disabled={!schedule}>MS Project XML</button>
          <button onClick={snapshot}>Snapshot PNG</button>
        </div>
      </details>
    ),
    projects: (
      <button className="tb" onClick={() => setProjectsTab("database")} title="Abrir a biblioteca de projetos">
        <FolderOpen {...I} />
        <span>Projetos</span>
      </button>
    ),
    save: (
      <button className="tb" onClick={() => void saveToDb(false).catch((e) => window.alert(e.message))} disabled={busy || (!schedule && !store.projectKey)} title="Salvar obra na biblioteca (Ctrl+S)">
        <Save {...I} />
        <span>Salvar</span>
      </button>
    ),
    p6: (
      <button className="tb" onClick={() => setProjectsTab("p6")} title="Import a project from a P6 connection">
        <Database {...I} />
        <span>Import from P6</span>
      </button>
    ),
    push: canPush ? (
      <button className="tb" onClick={pushToP6} title="Send progress back to P6 EPPM">
        <CloudUpload {...I} />
        <span>Update P6</span>
      </button>
    ) : null,
    dashboards: (
      <button className="tb" onClick={() => store.setView("dashboards")} title="Dashboards and reports">
        <LayoutDashboard {...I} />
        <span>Dashboards</span>
      </button>
    ),
    fit: (
      <button className="tb collapse" onClick={() => viewerRef.current?.fit(selectedElements.size ? selectedElements : undefined)} title="Zoom the 3D view to fit">
        <Maximize {...I} />
        <span>Fit view</span>
      </button>
    ),
    record: (
      <button onClick={toggleRecording} disabled={!schedule} className={`tb collapse ${recording ? "danger" : ""}`} title="Record the 4D playback as video">
        {recording ? <Square {...I} /> : <Video {...I} />}
        <span>{recording ? "Stop" : "Record"}</span>
      </button>
    ),
    demo: (
      <button className="tb" onClick={() => loadDemo("gis")} title="Load the 220 kV GIS substation sample project">
        <Sparkles {...I} />
        <span>Demo</span>
      </button>
    ),
    settings: (
      <button className="tb icon-only" onClick={() => setSettingsTab("interface")} title="Settings: interface, fonts, database, P6, email">
        <Settings {...I} />
      </button>
    ),
    help: (
      <button className="tb icon-only" title="Getting started and shortcuts (?)" onClick={() => setHelpOpen(true)}>
        <CircleHelp {...I} />
      </button>
    ),
  };

  const fileMenu = (
    <details className="menu">
      <summary className="tb" title="Arquivo">
        <Menu {...I} />
        <span>Arquivo</span>
        <ChevronDown size={13} aria-hidden className="chev" />
      </summary>
      <div className="menu-body" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute("open")}>
        <button onClick={() => setProjectsTab("database")}>Abrir da biblioteca…</button>
        <button onClick={() => void saveToDb(true).catch((e) => window.alert(e.message))} disabled={busy || (!schedule && !store.projectKey)}>Salvar como nova obra</button>
        <hr />
        <button disabled={busy} onClick={() => void importSchedule()}>Importar cronograma (XER / XML)…</button>
        <button disabled={busy || !schedule} onClick={() => void importSchedule(true)}>Atualizar cronograma…</button>
        <button disabled={!store.revisions?.length} onClick={() => setShowHistory(true)}>Histórico de revisões…</button>
        <button onClick={() => void importIfc()}>Adicionar modelo 3D…</button>
        <button onClick={() => setProjectsTab("p6")}>Import from P6…</button>
        {canPush && <button onClick={pushToP6}>Update P6 with progress</button>}
        <hr />
        <button onClick={openProject}>Abrir arquivo de projeto…</button>
        <button onClick={saveProject} disabled={busy || (!schedule && !store.projectKey)}>Salvar arquivo de projeto</button>
        <button disabled={!store.projectKey} onClick={() => {
          if (!window.confirm("Fechar esta obra? Salve as alterações que deseja guardar antes de fechar.")) return;
          applyProject({ ...emptyProject(), projectKey: undefined });
          setRestore(null);
          void clearAutosave();
          store.setStatus("Obra fechada.");
        }}>Fechar obra</button>
        {SAMPLE_ORDER.map((k) => (
          <button key={k} onClick={() => loadDemo(k)}>
            Sample: {SAMPLES[k].label}
          </button>
        ))}
      </div>
    </details>
  );

  const brand = (
    <div className="brand">
      <img className="logo-light" src="./stratum-logo.png" alt="Stratum 4D" />
      <img className="logo-dark" src="./stratum-logo-dark.png" alt="" aria-hidden />
    </div>
  );

  const toolbarRight = (
    <>
      <span className="spacer" />
      <span className="muted conn" title={`Projects are stored in: ${dbLabel}`}>
        {dbShort}
        {currentProjectId ? ` · v${currentVersion}` : ""}
      </span>
      {savedAt && <span className="muted autosaved">Autosaved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
      <ModeSwitch />
      {!isNativeApp() && <DisplaysButton className="tb icon-label" />}
      <TrainingButton className="tb" />
      <ThemeButton />
      {btn.settings}
      {btn.help}
    </>
  );

  const bannersNode = (
    <>
      {restore && (
        <div className="banner">
          Restore your last session? <b>{restore.schedule?.projectCode}</b>, {restore.links.length} links
          {restore.savedAt ? `, saved ${new Date(restore.savedAt).toLocaleString()}` : ""}.
          <button
            className="primary"
            onClick={() => {
              void restoreProject(restore, ++projectAction.current);
              setRestore(null);
            }}
          >
            Restore
          </button>
          <button
            onClick={() => {
              clearAutosave();
              setRestore(null);
            }}
          >
            Discard
          </button>
        </div>
      )}
      {scheduleDirty && (
        <div className="banner info">
          The schedule has been edited. Press <b>Schedule (F9)</b> to recalculate dates and float.
        </div>
      )}
    </>
  );

  const classicActions: ClassicActions = {
    projects: () => setProjectsTab("database"),
    openOne: openFromDb,
    openCombined: (schedule) => applyProject({ ...emptyProject(), schedule }),
    importToDb: async (eps: string[]) => {
      const f = await pickFile(".xer,.xml");
      if (!f) return;
      const s = readScheduleFile(f.name, new Uint8Array(await f.arrayBuffer()));
      if (!s) return;
      applyProject({ ...emptyProject(), schedule: { ...s, eps } });
      await saveToDb(true);
    },
    saveDb: () => saveToDb(false),
    save: () => void saveToDb(false).catch((e) => window.alert(e.message)),
    saveAsNew: () => void saveToDb(true).catch((e) => window.alert(e.message)),
    importSchedule: () => void importSchedule(),
    importP6: () => setProjectsTab("p6"),
    pushP6: canPush ? pushToP6 : null,
    schedule: runSchedule,
    exportXer: () => exportSchedule("xer"),
    exportCsv: () => exportSchedule("csv"),
    exportMspdi: () => exportSchedule("mspdi"),
    openFile: openProject,
    saveFile: saveProject,
    sample: (k) => loadDemo(k),
    assignBaseline: () => void assignBaselineFromFile(),
    dashboards: () => store.setView("dashboards"),
    settings: (tab) => setSettingsTab(tab ?? "interface"),
    help: () => setHelpOpen(true),
    dbLabel,
  };
  registerTrainingBridge({ loadSample: () => loadDemo("gis"), schedule: runSchedule });

  return (
    <div className={`app mode-${mode}`}>
      <TrainingLayer />
      {mode === "4d" && (
        <header className="toolbar">
          {brand}
          {fileMenu}
          {btn.projects}
          {btn.save}
          {store.projectTitle && <span className="project-active" title={store.projectTitle}>{store.projectTitle}</span>}
          <span className="sep" />
          {btn.importIfc}
          {btn.importSchedule}
          {btn.push}
          {btn.run}
          {btn.exportMenu}
          <span className="sep" />
          {btn.fit}
          {btn.record}
          {toolbarRight}
        </header>
      )}
      {mode === "4d" && bannersNode}
      {pathDraft && (
        <div className="banner info">
          Drawing a path: click points in the 3D view ({pathDraft.length} so far). Finish or cancel in the <b>Tools</b> tab, or press Esc.
        </div>
      )}
      {helpOpen && (
        <Help
          onClose={() => setHelpOpen(false)}
          onDemo={() => {
            setHelpOpen(false);
            loadDemo();
          }}
        />
      )}
      {mode === "4d" && (
        <main className="workspace">
          <section className="left">
            <div className="tabs left-tabs">
              {LEFT_TABS.map((x) => (
                <button key={x.id} className={leftTab === x.id ? "active" : ""} onClick={() => store.setLeftTab(x.id)}>
                  {x.id === "activity" ? t.activity : x.label}
                </button>
              ))}
            </div>
            <div className="left-body">
              {leftTab === "gantt" && <Gantt />}
              {leftTab === "activity" && <ActivityEditor />}
              {leftTab === "cost" && <CostPanel />}
              {leftTab === "resources" && <ResourcePanel />}
              {leftTab === "quantities" && <QuantityPanel />}
            </div>
          </section>
          <section className="center">{viewport}</section>
          <section className="right">
            <SidePanel />
          </section>
        </main>
      )}
      {mode === "p6" && (
        <P6Screen
          a={classicActions}
          banners={bannersNode}
          status={status}
          displays={isNativeApp() ? undefined : { menu: [{ label: "Displays: Open a View on Another Monitor…", onClick: () => useDisplays.getState().show(true) }] }}
        />
      )}
      {mode === "msp" && <MspScreen a={classicActions} banners={bannersNode} status={status} />}
      {mode === "4d" && (
      <footer>
        <Timeline />
        <div className={`status ${busy ? "busy" : ""}`}>
          {status}
          <span className="muted">
            {elements.length ? ` · ${elements.length} elements` : ""}
            {links.length ? ` · ${links.length} links` : ""}
          </span>
        </div>
      </footer>
      )}
      <DisplaysDialog />
      {store.view === "dashboards" && (
        <div className="overlay-view">
          <DashboardsView onClose={() => store.setView("workspace")} />
        </div>
      )}
      {projectsTab && (
        <ProjectsDialog
          initialTab={projectsTab}
          onClose={() => setProjectsTab(null)}
          onOpen={async (id) => {
            await openFromDb(id);
            setProjectsTab(null);
          }}
          onSave={saveToDb}
          onNew={(name) => {
            if (useStore.getState().projectKey && !window.confirm("Abrir uma nova obra? Salve as alterações que deseja manter antes de trocar.")) return;
            applyProject(emptyProject(name));
            setRestore(null);
            setProjectsTab(null);
            store.setStatus(`Obra ${name} criada. Importe os modelos e o cronograma em qualquer ordem.`);
          }}
          onMetadata={(id, project, previous, version) => {
            const current = useStore.getState();
            if (id === current.currentProjectId && current.currentVersion === previous) {
              useStore.setState({ projectTitle: project.title ?? null, projectArchived: !!project.archived, currentVersion: version });
            }
          }}
          onDeleted={(id) => {
            if (id !== useStore.getState().currentProjectId) return;
            applyProject({ ...emptyProject(), projectKey: undefined });
            setRestore(null);
            void clearAutosave();
            store.setStatus("Obra excluída da biblioteca.");
          }}
          onImportP6={(sch, c) => {
            importFromP6(sch, c);
            setProjectsTab(null);
          }}
        />
      )}
      {settingsTab && <SettingsDialog initialTab={settingsTab} onClose={() => setSettingsTab(null)} />}
      {revisionOffer && <RevisionDialog offer={revisionOffer.review} onFinish={revisionOffer.finish} />}
      {showHistory && <RevisionHistory entries={store.revisions ?? []} busy={busy} onClose={() => setShowHistory(false)} onRestore={(e) => void restoreRevision(e)} onDownload={(e) => void downloadRevision(e)} />}
      {!config.configured && (
        <SetupWizard
          onDone={(open) => {
            if (open === "p6") setSettingsTab("p6");
            else if (open === "email") setSettingsTab("email");
          }}
        />
      )}
    </div>
  );
}

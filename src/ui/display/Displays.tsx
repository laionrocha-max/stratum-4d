// Multi-display: open any view in its own window, move it to another
// monitor, and save the arrangement as a display setup to reopen later.
// Every window shows the same project live (see sync.ts).

import { MonitorUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { syncHandle } from "./sync";

export interface ViewDef {
  id: string;
  label: string;
  hint: string;
}

export const DISPLAY_VIEWS: ViewDef[] = [
  { id: "activities", label: "Activities (table + Gantt)", hint: "The P6 activity table with its Gantt chart" },
  { id: "table", label: "Tabela de atividades", hint: "Columns only: good for a portrait monitor" },
  { id: "gantt", label: "Gráfico de Gantt", hint: "Bars, relationships and the data date line" },
  { id: "progress", label: "Planilha de atualização de avanço", hint: "Status, actual dates, % complete and remaining duration, editable" },
  { id: "details", label: "Detalhes da atividade", hint: "All detail tabs for the activity selected in any window" },
  { id: "network", label: "Rede de atividades", hint: "Logic diagram; click a box to select it everywhere" },
  { id: "trace", label: "Rastrear dependências", hint: "Predecessors and successors of the selected activity" },
  { id: "resourceUsage", label: "Planilha de uso de recursos", hint: "Units or cost per month or week" },
  { id: "activityUsage", label: "Planilha de uso de atividades", hint: "Units or cost per activity and period" },
  { id: "resourceProfile", label: "Perfil de uso de recursos", hint: "Histograma de recursos" },
  { id: "earnedValue", label: "Earned value and S-curves", hint: "PV, EV, AC, SPI, CPI" },
  { id: "dashboard", label: "Painéis", hint: "Any dashboard, updating as the schedule changes" },
  { id: "wbs", label: "EAP", hint: "Editor da EAP" },
  { id: "assignments", label: "Atribuições", hint: "Every resource assignment" },
  { id: "issues", label: "Pendências", hint: "Issue register" },
  { id: "risks", label: "Riscos", hint: "Risk register" },
];

export const viewLabel = (id: string) => DISPLAY_VIEWS.find((v) => v.id === id)?.label ?? id;

export interface DisplayWin {
  view: string;
  /** Screen position and size; null = let the browser choose. */
  x: number | null;
  y: number | null;
  w: number;
  h: number;
  /** Label of the monitor it was on, when known. */
  screen?: string;
}

export interface DisplaySetup {
  name: string;
  windows: DisplayWin[];
}

const KEY = "stratum.displays.v1";
const read = (): DisplaySetup[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};

/** Ready-made setups for two and three monitors. */
export const STOCK_SETUPS: DisplaySetup[] = [
  { name: "Two monitors: Gantt + details", windows: [{ view: "gantt", x: null, y: null, w: 1400, h: 900 }, { view: "details", x: null, y: null, w: 900, h: 700 }] },
  { name: "Progress update: sheet + Gantt", windows: [{ view: "progress", x: null, y: null, w: 1200, h: 900 }, { view: "gantt", x: null, y: null, w: 1400, h: 900 }] },
  {
    name: "Three monitors: table, Gantt, dashboard",
    windows: [
      { view: "table", x: null, y: null, w: 1100, h: 900 },
      { view: "gantt", x: null, y: null, w: 1400, h: 900 },
      { view: "dashboard", x: null, y: null, w: 1400, h: 900 },
    ],
  },
];

interface DisplaysState {
  open: boolean;
  setups: DisplaySetup[];
  /** Windows the browser blocked; opened one per click. */
  queue: DisplayWin[];
  show: (on: boolean) => void;
  save: (s: DisplaySetup) => void;
  remove: (name: string) => void;
  setQueue: (q: DisplayWin[]) => void;
}

export const useDisplays = create<DisplaysState>((set, get) => ({
  open: false,
  setups: read(),
  queue: [],
  show: (open) => set({ open }),
  save: (s) => {
    const setups = [...get().setups.filter((x) => x.name !== s.name), s];
    set({ setups });
    try {
      localStorage.setItem(KEY, JSON.stringify(setups));
    } catch {
      /* ignore */
    }
  },
  remove: (name) => {
    const setups = get().setups.filter((x) => x.name !== name);
    set({ setups });
    try {
      localStorage.setItem(KEY, JSON.stringify(setups));
    } catch {
      /* ignore */
    }
  },
  setQueue: (queue) => set({ queue }),
}));

let seq = 0;
/** Open one view in a new window. Returns false when the browser blocked it. */
export function openDisplay(w: DisplayWin): boolean {
  const id = `${Date.now().toString(36)}${(seq++).toString(36)}`;
  const base = location.href.split("#")[0];
  const url = `${base}#display=${encodeURIComponent(w.view)}&id=${id}`;
  const feat = [`popup=yes`, `width=${Math.round(w.w)}`, `height=${Math.round(w.h)}`];
  if (w.x !== null && w.y !== null) feat.push(`left=${Math.round(w.x)}`, `top=${Math.round(w.y)}`);
  const win = window.open(url, `stratum-display-${id}`, feat.join(","));
  return !!win;
}

/** Open every window of a setup; the ones the browser blocks wait for a click each. */
export function openSetup(s: DisplaySetup) {
  const blocked: DisplayWin[] = [];
  for (const w of s.windows) if (!openDisplay(w)) blocked.push(w);
  useDisplays.getState().setQueue(blocked);
}

/** Ask the open display windows where they are, to save the arrangement. */
export function captureSetup(name: string): Promise<DisplaySetup> {
  const h = syncHandle();
  return new Promise((resolve) => {
    const wins: DisplayWin[] = [];
    if (!h) return resolve({ name, windows: [] });
    const off = h.on((m) => {
      if (m.t === "bounds") wins.push({ view: m.view, x: m.x, y: m.y, w: m.w, h: m.h });
    });
    h.post({ t: "bounds?", from: h.id });
    setTimeout(() => {
      off();
      resolve({ name, windows: wins });
    }, 400);
  });
}

type ScreenInfo = { label: string; availLeft: number; availTop: number; availWidth: number; availHeight: number; isPrimary?: boolean };

/** Monitors, when the browser lets us ask (Window Management API). Electron and Chrome support it. */
async function screens(): Promise<ScreenInfo[] | null> {
  const w = window as unknown as { getScreenDetails?: () => Promise<{ screens: ScreenInfo[] }> };
  if (!w.getScreenDetails) return null;
  try {
    const d = await w.getScreenDetails();
    return d.screens;
  } catch {
    return null;
  }
}

export function DisplaysButton({ className = "tb" }: { className?: string }) {
  const show = useDisplays((s) => s.show);
  return (
    <button className={className} onClick={() => show(true)} title="Monitores: abrir cada vista em uma janela própria">
      <MonitorUp size={15} aria-hidden /> <span className="tb-label">Monitores</span>
    </button>
  );
}

export function DisplaysDialog() {
  const { open, setups, queue, show, save, remove, setQueue } = useDisplays();
  const [view, setView] = useState("gantt");
  const [mons, setMons] = useState<ScreenInfo[] | null>(null);
  const [mon, setMon] = useState(-1);
  const [name, setName] = useState("");
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setCount(syncHandle()?.peers().size ?? 0), 700);
    setCount(syncHandle()?.peers().size ?? 0);
    return () => clearInterval(t);
  }, [open]);

  if (!open && !queue.length) return null;
  if (!open)
    return (
      <div className="display-queue">
        {queue.length} display window{queue.length > 1 ? "s" : ""} blocked by the browser.
        <button
          className="primary"
          onClick={() => {
            const [first, ...rest] = queue;
            openDisplay(first);
            setQueue(rest);
          }}
        >
          Abrir {viewLabel(queue[0].view)}
        </button>
        <button className="link" onClick={() => setQueue([])}>
          Dispensar
        </button>
      </div>
    );

  const place = (): DisplayWin => {
    const s = mons && mon >= 0 ? mons[mon] : null;
    return s
      ? { view, x: s.availLeft, y: s.availTop, w: s.availWidth, h: s.availHeight, screen: s.label }
      : { view, x: window.screenX + 60, y: window.screenY + 60, w: Math.min(1400, screen.availWidth - 80), h: Math.min(900, screen.availHeight - 80) };
  };

  return (
    <div className="help-backdrop p6-dlg-back" onMouseDown={(e) => e.target === e.currentTarget && show(false)}>
      <div className="p6-dlg wide displays" role="dialog" aria-label="Monitores">
        <div className="p6-dlg-title">
          <span>Monitores</span>
          <button className="icon-btn" onClick={() => show(false)} aria-label="Fechar">
            <X size={14} aria-hidden />
          </button>
        </div>
        <div className="p6-dlg-body">
          <p>Open a view in its own window and drag it to another monitor. All windows show the same project: select, edit or reschedule in one and the others follow.</p>
          <div className="display-grid">
            {DISPLAY_VIEWS.map((v) => (
              <button key={v.id} className={view === v.id ? "on" : ""} onClick={() => setView(v.id)} title={v.hint}>
                <b>{v.label}</b>
                <span>{v.hint}</span>
              </button>
            ))}
          </div>
          <div className="row">
            {mons ? (
              <label>
                Monitor
                <select value={mon} onChange={(e) => setMon(Number(e.target.value))}>
                  <option value={-1}>Next to this window</option>
                  {mons.map((s, i) => (
                    <option key={i} value={i}>
                      {s.label || `Screen ${i + 1}`} ({s.availWidth}×{s.availHeight}){s.isPrimary ? " – primary" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button
                onClick={async () => {
                  const s = await screens();
                  if (s) setMons(s);
                  else setMsg("This browser does not report monitors. Open the window, then drag it to the monitor you want; Save setup remembers where it is.");
                }}
              >
                Detectar monitores
              </button>
            )}
            <span className="spacer" />
            <button
              className="primary"
              onClick={() => {
                if (!openDisplay(place())) setMsg("The browser blocked the new window. Allow pop-ups for Stratum and try again.");
                else setMsg(`Opened ${viewLabel(view)}.`);
              }}
            >
              Abrir {viewLabel(view)}
            </button>
          </div>
          {msg && <p className="muted small">{msg}</p>}
          <h4>Configurações de monitores</h4>
          <p className="muted small">
            {count ? `${count} display window${count > 1 ? "s" : ""} open.` : "No display windows open."} Arrange them on your monitors, then save the arrangement to reopen it in one click.
          </p>
          <div className="row">
            <input placeholder="Setup name, e.g. Office – 3 screens" value={name} onChange={(e) => setName(e.target.value)} />
            <button
              disabled={!name.trim() || !count}
              onClick={async () => {
                const s = await captureSetup(name.trim());
                if (!s.windows.length) return setMsg("No display windows answered. Open some first.");
                save(s);
                setName("");
                setMsg(`Saved “${s.name}” with ${s.windows.length} window${s.windows.length > 1 ? "s" : ""}.`);
              }}
            >
              Salvar configuração atual
            </button>
            <button disabled={!count} onClick={() => syncHandle()?.post({ t: "close", from: "main" })}>
              Fechar todas as janelas de exibição
            </button>
          </div>
          <table className="p6-grid">
            <tbody>
              {[...setups.map((s) => ({ s, mine: true })), ...STOCK_SETUPS.map((s) => ({ s, mine: false }))].map(({ s, mine }) => (
                <tr key={`${mine}${s.name}`}>
                  <td>
                    <b>{s.name}</b> {!mine && <span className="muted">(example)</span>}
                  </td>
                  <td className="muted small">{s.windows.map((w) => viewLabel(w.view)).join(" · ")}</td>
                  <td className="nowrap">
                    <button className="link" onClick={() => openSetup(s)}>
                      Abrir
                    </button>
                    {mine && (
                      <button className="link" onClick={() => remove(s.name)}>
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p6-dlg-foot">
          <span className="muted small">Tip: in the desktop app and in Chrome or Edge, Detect monitors places windows on a chosen screen.</span>
          <span className="spacer" />
          <button onClick={() => show(false)}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

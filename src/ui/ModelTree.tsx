import { ChevronDown, ChevronRight, Eye, EyeOff, Focus, Scan, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { buildModelTree, modelLeaves, modelTreeFilter, type ModelNode } from "../core/modelTree";
import { compileVisibility, elementVisibilityKey, EMPTY_VISIBILITY, explicitlyHidden } from "../core/visibility";
import { useStore } from "./store";

export interface InspectionTarget { ids: string[]; x: number; y: number; label: string }
const ROW = 30;

export function hideElements(ids: string[]) {
  const state = useStore.getState();
  const settings = state.view3d.visibility ?? EMPTY_VISIBILITY;
  state.setVisibility({ ...settings, hidden: [...new Set([...settings.hidden, ...ids])] });
}

export function focusElements(ids: string[], mode: "isolated" | "ghost") {
  const state = useStore.getState();
  state.setVisibility({ ...(state.view3d.visibility ?? EMPTY_VISIBILITY), isolated: mode === "isolated" ? ids : null, ghost: mode === "ghost" ? ids : null });
}

export function showElements() {
  const state = useStore.getState();
  const settings = state.view3d.visibility ?? EMPTY_VISIBILITY;
  state.setVisibility({ ...EMPTY_VISIBILITY, hiddenModels: settings.hiddenModels, ghostOpacity: settings.ghostOpacity });
}

function changeSelection(ids: string[], additive: boolean) {
  const state = useStore.getState();
  const selected = additive ? new Set(state.selectedElements) : new Set<string>();
  const remove = additive && ids.every((id) => selected.has(id));
  for (const id of ids) {
    if (remove) selected.delete(id);
    else selected.add(id);
  }
  state.selectElements(selected);
}

export function ModelTree({ onClose, onMenu }: { onClose: () => void; onMenu: (target: InspectionTarget) => void }) {
  const elements = useStore((s) => s.elements);
  const models = useStore((s) => s.models?.files);
  const modelName = useStore((s) => s.modelFileName);
  const selected = useStore((s) => s.selectedElements);
  const settings = useStore((s) => s.view3d.visibility ?? EMPTY_VISIBILITY);
  const canUndo = useStore((s) => s.visibilityPast.length > 0);
  const canRedo = useStore((s) => s.visibilityFuture.length > 0);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState("");
  const [active, setActive] = useState("");
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(300);
  const container = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => buildModelTree(elements, models ?? [], modelName ?? "Modelo"), [elements, models, modelName]);
  const paths = useMemo(() => {
    const index = new Map<string, ModelNode[]>();
    const visit = (node: ModelNode, ancestors: ModelNode[]) => {
      if (node.element) index.set(node.element.id, [...ancestors, node]);
      else for (const child of node.children) visit(child, [...ancestors, node]);
    };
    for (const root of tree) visit(root, []);
    return index;
  }, [tree]);
  const systems = useMemo(() => [...new Set(elements.flatMap((e) => e.systems ?? []))].sort(), [elements]);
  const filtered = useMemo(() => modelTreeFilter(tree, query, system), [tree, query, system]);
  const inspection = useMemo(() => compileVisibility(settings), [settings]);
  const eyes = useMemo(() => {
    const counts = new Map<string, { visible: number; total: number }>();
    const count = (node: ModelNode): { visible: number; total: number } => {
      const e = node.element;
      const result = e
        ? { visible: explicitlyHidden(inspection, e.id, elementVisibilityKey(e)) ? 0 : 1, total: 1 }
        : node.children.reduce((a, child) => {
          const b = count(child);
          return { visible: a.visible + b.visible, total: a.total + b.total };
        }, { visible: 0, total: 0 });
      counts.set(node.key, result);
      return result;
    };
    tree.forEach(count);
    return counts;
  }, [tree, inspection]);
  const open = (node: ModelNode) => !!filtered || (node.kind === "model" ? !expanded.has(node.key) : expanded.has(node.key));
  const rows = useMemo(() => {
    const shown: { node: ModelNode; depth: number; parent?: string }[] = [];
    const visit = (node: ModelNode, depth: number, parent?: string) => {
      if (filtered && !filtered.has(node.key)) return;
      shown.push({ node, depth, parent });
      if (filtered || (node.kind === "model" ? !expanded.has(node.key) : expanded.has(node.key))) {
        node.children.forEach((child) => visit(child, depth + 1, node.key));
      }
    };
    tree.forEach((root) => visit(root, 1));
    return shown;
  }, [tree, filtered, expanded]);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const resize = new ResizeObserver(() => setHeight(el.clientHeight));
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    if (container.current) container.current.scrollTop = 0;
    setTop(0);
  }, [query, system]);

  const lastSelection = useRef<ReadonlySet<string> | null>(null);
  const reveal = useRef<string | null>(null);
  useEffect(() => {
    if (lastSelection.current === selected) return;
    lastSelection.current = selected;
    if (selected.size !== 1 || filtered) return;
    const path = paths.get(selected.values().next().value!);
    if (!path) return;
    const leaf = path.at(-1)!;
    setActive(leaf.key);
    reveal.current = leaf.key;
    setExpanded((current) => {
      const next = new Set(current);
      for (const node of path.slice(0, -1)) {
        if (node.kind === "model") next.delete(node.key);
        else next.add(node.key);
      }
      return next;
    });
  }, [selected, paths, filtered]);
  useEffect(() => {
    const el = container.current;
    if (!el || !reveal.current) return;
    const index = rows.findIndex((row) => row.node.key === reveal.current);
    if (index < 0) return;
    reveal.current = null;
    if (index * ROW < el.scrollTop || (index + 1) * ROW > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, index * ROW - (el.clientHeight - ROW) / 2);
    }
  }, [rows]);

  const toggleExpand = (node: ModelNode) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(node.key)) next.delete(node.key);
    else next.add(node.key);
    return next;
  });
  const moveFocus = (index: number) => {
    const row = rows[index];
    const el = container.current;
    if (!row || !el) return;
    setActive(row.node.key);
    if (index * ROW < el.scrollTop) el.scrollTop = index * ROW;
    if ((index + 1) * ROW > el.scrollTop + el.clientHeight) el.scrollTop = (index + 1) * ROW - el.clientHeight;
  };
  const toggleEye = (node: ModelNode) => {
    const state = useStore.getState();
    const current = state.view3d.visibility ?? EMPTY_VISIBILITY;
    const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    if (node.kind === "model") {
      state.setVisibility({ ...current, hiddenModels: toggle(current.hiddenModels, node.modelId) });
      return;
    }
    if (current.hiddenModels.includes(node.modelId)) return;
    if (node.category && node.kind === "category") {
      state.setVisibility({ ...current, hiddenCategories: toggle(current.hiddenCategories, node.category) });
      return;
    }
    const ids = modelLeaves(node).map((e) => e.id);
    const hidden = new Set(current.hidden);
    const targets = new Set(ids);
    const hide = !ids.every((id) => hidden.has(id));
    state.setVisibility({ ...current, hidden: hide ? [...new Set([...current.hidden, ...ids])] : current.hidden.filter((id) => !targets.has(id)) });
  };
  const menu = (node: ModelNode, x: number, y: number) => {
    const ids = modelLeaves(node).map((e) => e.id);
    if (!ids.every((id) => selected.has(id))) changeSelection(ids, false);
    onMenu({ ids: ids.every((id) => selected.has(id)) && node.element ? [...selected] : ids, label: node.label, x, y });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length) return;
    const index = Math.max(0, rows.findIndex((row) => row.node.key === active));
    const { node, parent } = rows[index];
    const key = event.key.toLowerCase();
    if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "home", "end", "enter", " ", "v", "h", "i", "g", "escape", "f10"].includes(key)) return;
    if (key === "f10" && !event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (key === "arrowdown") moveFocus(Math.min(index + 1, rows.length - 1));
    else if (key === "arrowup") moveFocus(Math.max(index - 1, 0));
    else if (key === "home") moveFocus(0);
    else if (key === "end") moveFocus(rows.length - 1);
    else if (key === "arrowright" && node.children.length) {
      if (!open(node)) toggleExpand(node);
      else if (rows[index + 1]?.parent === node.key) moveFocus(index + 1);
    } else if (key === "arrowleft") {
      if (node.children.length && open(node) && !filtered) toggleExpand(node);
      else if (parent) moveFocus(rows.findIndex((row) => row.node.key === parent));
    } else if (key === "v") toggleEye(node);
    else if (key === "escape") changeSelection([], false);
    else if (key === "h" && selected.size) hideElements([...selected]);
    else if ((key === "i" || key === "g") && selected.size) focusElements([...selected], key === "i" ? "isolated" : "ghost");
    else if (key === "enter" || key === " ") changeSelection(modelLeaves(node).map((e) => e.id), event.ctrlKey || event.shiftKey || event.metaKey);
    else if (key === "f10" && event.shiftKey) {
      const box = container.current!.getBoundingClientRect();
      menu(node, box.left + 36, box.top + 38);
    }
  };
  const start = Math.min(Math.max(0, rows.length - 1), Math.max(0, Math.floor(top / ROW) - 6));
  const end = Math.min(rows.length, start + Math.ceil(height / ROW) + 12);
  const activeIndex = rows.findIndex((row) => row.node.key === active);
  const selection = [...selected];
  return (
    <section className="ifc-tree-panel" aria-label="Painel da árvore IFC">
      <div className="ifc-tree-head">
        <strong>Árvore IFC</strong><small>{selected.size} selecionado(s)</small>
        <button className="icon-only" title="Fechar árvore IFC" aria-label="Fechar árvore IFC" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="ifc-tree-tools">
        <input placeholder="Buscar elementos ou GlobalId" aria-label="Buscar na árvore IFC" value={query} onChange={(e) => setQuery(e.target.value)} />
        {!!systems.length && <select value={system} onChange={(e) => setSystem(e.target.value)} aria-label="Sistema IFC"><option value="">Todos os sistemas IFC</option>{systems.map((name) => <option key={name}>{name}</option>)}</select>}
      </div>
      <div
        className="ifc-tree-list" role="tree" aria-label="Elementos do IFC" aria-multiselectable="true"
        tabIndex={0} ref={container} onKeyDown={onKeyDown} onScroll={(e) => setTop(e.currentTarget.scrollTop)}
        aria-activedescendant={activeIndex >= start && activeIndex < end ? `ifc-row-${activeIndex}` : undefined}
      >
        {!rows.length && <p className="muted">{elements.length ? "Nenhum elemento corresponde à busca." : "Adicione um IFC para navegar pela sua estrutura."}</p>}
        <div style={{ height: rows.length * ROW, position: "relative" }}>
          {rows.slice(start, end).map(({ node, depth }, i) => {
            const count = eyes.get(node.key)!;
            const marked = node.element ? selected.has(node.element.id) : false;
            const shown = count.total ? count.visible > 0 : !inspection.models.has(node.modelId);
            const partial = count.visible > 0 && count.visible < count.total;
            const eyeLabel = `${shown ? "Ocultar" : "Mostrar"} ${node.label}`;
            const modelOff = node.kind !== "model" && inspection.models.has(node.modelId);
            return (
              <div
                id={`ifc-row-${start + i}`} key={node.key} className={`ifc-tree-row ${marked ? "selected" : ""} ${active === node.key ? "current" : ""}`}
                style={{ top: (start + i) * ROW, height: ROW, paddingInlineStart: (depth - 1) * 14 + 4 }}
                role="treeitem" aria-level={depth} aria-selected={marked} aria-expanded={node.children.length ? open(node) : undefined} aria-label={node.label}
                onContextMenu={(e: MouseEvent) => { e.preventDefault(); menu(node, e.clientX, e.clientY); }}
                onClick={(e) => { setActive(node.key); changeSelection(modelLeaves(node).map((item) => item.id), e.ctrlKey || e.metaKey || e.shiftKey); container.current?.focus(); }}
              >
                {node.children.length ? <button tabIndex={-1} className="icon-only" title={open(node) ? "Recolher" : "Expandir"} aria-label={`${open(node) ? "Recolher" : "Expandir"} ${node.label}`} onClick={(e) => { e.stopPropagation(); toggleExpand(node); }}>{open(node) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button> : <span className="ifc-tree-indent" />}
                <span className="ifc-tree-label" title={node.label}>{node.label}</span>
                {partial && <small title="Alguns itens estão ocultos">Parcial</small>}
                <button tabIndex={-1} className="icon-only" disabled={modelOff} aria-label={eyeLabel} title={modelOff ? "Reative o modelo para mudar a visibilidade dos seus elementos" : `${eyeLabel} (V)`} onClick={(e) => { e.stopPropagation(); toggleEye(node); }}>{shown ? <Eye size={16} /> : <EyeOff size={16} />}</button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ifc-tree-actions">
        <button title="Ocultar seleção (H)" disabled={!selected.size} onClick={() => hideElements(selection)}>Ocultar seleção</button>
        <button title="Isolar seleção (I)" disabled={!selected.size} aria-pressed={!!settings.isolated} onClick={() => focusElements(selection, "isolated")}><Focus size={14} /> Isolar</button>
        <button title="Destacar com Ghost (G)" disabled={!selected.size} aria-pressed={!!settings.ghost} onClick={() => focusElements(selection, "ghost")}><Scan size={14} /> Ghost</button>
        <button title="Limpa a visibilidade manual dos elementos e mantém os modelos desligados" onClick={showElements}>Mostrar todos</button>
        {!!settings.hiddenModels.length && <button onClick={() => useStore.getState().setVisibility({ ...settings, hiddenModels: [] })}>Reativar modelos</button>}
        <button disabled={!canUndo} onClick={() => useStore.getState().undoVisibility()}>Desfazer visibilidade</button>
        <button disabled={!canRedo} onClick={() => useStore.getState().redoVisibility()}>Refazer visibilidade</button>
      </div>
      {!!settings.ghost && <label className="ifc-ghost-opacity">Opacidade dos demais
        <input type="range" min="0.05" max="0.85" step="0.05" aria-label="Opacidade dos elementos Ghost" value={settings.ghostOpacity} onChange={(e) => useStore.getState().setVisibility({ ...settings, ghostOpacity: Number(e.target.value) })} />
      </label>}
    </section>
  );
}

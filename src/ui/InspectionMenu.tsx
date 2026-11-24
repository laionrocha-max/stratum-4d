import { useEffect, useRef } from "react";
import { categoryKey } from "../core/modelTree";
import { focusElements, hideElements, showElements, type InspectionTarget } from "./ModelTree";
import { useStore } from "./store";
import type { Viewer } from "../viewer/Viewer";

export function InspectionMenu({ target, viewer, onClose }: { target: InspectionTarget; viewer: Viewer | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector("button")?.focus();
    const dismiss = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [onClose]);
  const run = (action: () => void) => {
    action();
    onClose();
  };
  const modelElements = useStore((state) => state.elements);
  const ids = new Set(target.ids);
  const elements = modelElements.filter((e) => ids.has(e.id));
  const similar = (scope: "category" | "type" | "system") => {
    const categories = new Set(elements.map(categoryKey));
    const types = new Set(elements.map((e) => e.ifcType.toUpperCase()));
    const systems = new Set(elements.flatMap((e) => (e.systems ?? []).map((s) => JSON.stringify([e.modelId, s]))));
    const matches = modelElements.filter((e) => {
      if (scope === "category") return categories.has(categoryKey(e));
      if (scope === "type") return types.has(e.ifcType.toUpperCase());
      return e.systems?.some((s) => systems.has(JSON.stringify([e.modelId, s])));
    });
    useStore.getState().selectElements(new Set(matches.map((e) => e.id)));
  };
  const openSelection = (linking = false) => {
    const state = useStore.getState();
    state.selectElements(ids);
    state.setSideTab("selection");
    if (linking) state.setStatus("Escolha a atividade no Gantt e use Vincular no painel Seleção.");
  };
  return (
    <div ref={ref} className="ifc-context-menu" role="menu" aria-label={target.label || "Ações da vista 3D"}
      style={{ left: Math.max(8, Math.min(target.x, window.innerWidth - 278)), top: Math.max(8, Math.min(target.y, window.innerHeight - 375)) }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          returnFocus.current?.focus();
          onClose();
          return;
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        e.stopPropagation();
        const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(current + items.length + (e.key === "ArrowDown" ? 1 : -1)) % items.length]?.focus();
      }}
    >
      {!!target.ids.length && <>
        <button role="menuitem" onClick={() => run(() => hideElements(target.ids))}>Ocultar seleção</button>
        <button role="menuitem" onClick={() => run(() => focusElements(target.ids, "isolated"))}>Isolar seleção</button>
        <button role="menuitem" onClick={() => run(() => focusElements(target.ids, "ghost"))}>Destacar com Ghost</button>
        <button role="menuitem" onClick={() => run(() => viewer?.fit(target.ids, 600))}>Enquadrar seleção</button>
        <button role="menuitem" onClick={() => run(() => similar("category"))}>Selecionar mesma categoria no ramo</button>
        <button role="menuitem" onClick={() => run(() => similar("type"))}>Selecionar mesma classe na obra</button>
        {elements.some((e) => !!e.systems?.length) && <button role="menuitem" onClick={() => run(() => similar("system"))}>Selecionar mesmo sistema no modelo</button>}
        <button role="menuitem" onClick={() => run(() => openSelection(true))}>Vincular a uma atividade</button>
        <button role="menuitem" onClick={() => run(() => openSelection())}>Propriedades</button>
      </>}
      <button role="menuitem" onClick={() => run(showElements)}>Mostrar todos</button>
      <button role="menuitem" onClick={() => run(() => viewer?.zoomAll())}>Enquadrar tudo</button>
      <button role="menuitem" onClick={() => run(() => useStore.getState().selectElements(new Set()))}>Limpar seleção</button>
    </div>
  );
}

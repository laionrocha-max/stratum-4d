import { describe, expect, it } from "vitest";
import { buildModelTree, categoryKey, modelLeaves, modelTreeFilter } from "../src/core/modelTree";
import { compileVisibility, displayElement, elementVisibilityKey, EMPTY_VISIBILITY, normalizeVisibility } from "../src/core/visibility";
import type { ModelElement } from "../src/core/types";

const wall: ModelElement = {
  id: "arq:parede", modelId: "arq", name: "Parede da piscina", ifcType: "IfcWall", expressId: 39,
  properties: { GlobalId: "parede" }, systems: ["Água fria"],
  spatial: [{ id: "edificio", name: "Complexo esportivo", type: "IFCBUILDING" }, { id: "terreo", name: "Térreo", type: "IFCBUILDINGSTOREY" }],
};
const other: ModelElement = { ...wall, id: "est:parede", modelId: "est", name: "Parede estrutural", systems: [], spatial: [] };

describe("árvore IFC", () => {
  const roots = buildModelTree([wall, other], [{ id: "arq", name: "Arquitetura" }, { id: "est", name: "Estrutura" }], "Modelo");
  it("agrupa por modelo, hierarquia do arquivo e categoria", () => {
    const [architecture, structure] = roots;
    expect(architecture.children[0].label).toBe("Complexo esportivo");
    expect(architecture.children[0].children[0].label).toBe("Térreo");
    expect(architecture.children[0].children[0].children[0].label).toBe("Paredes");
    expect(structure.children[0].label).toBe("Sem hierarquia IFC informada");
    expect(modelLeaves(architecture)).toEqual([wall]);
    expect(modelLeaves(structure)).toEqual([other]);
    expect(categoryKey(wall)).not.toBe(categoryKey(other));
  });
  it("busca GlobalId no projeto inteiro e filtra o sistema declarado pelo IFC", () => {
    const [architecture, structure] = roots;
    const byGuid = modelTreeFilter(roots, "parede", "");
    expect(byGuid?.has(architecture.key)).toBe(true);
    expect(byGuid?.has(structure.key)).toBe(true);
    const filtered = modelTreeFilter(roots, "TÉRREO", "Água fria");
    expect(filtered?.has(architecture.key)).toBe(true);
    expect(filtered?.has(structure.key)).toBe(false);
    expect(modelTreeFilter(roots, "parede", "Elétrica")?.size).toBe(0);
  });
});

describe("visibilidade da inspeção IFC", () => {
  const flags = (patch = {}, item = wall, scheduled = true, selected = false, playing = false, focus: Set<string> | null = null) =>
    displayElement(compileVisibility({ ...EMPTY_VISIBILITY, ...patch }), item.id, elementVisibilityKey(item), scheduled, selected, playing, focus);

  it("mantém todos os níveis de ocultação mesmo com seleção, isolamento e Ghost", () => {
    for (const explicit of [{ hidden: [wall.id] }, { hiddenModels: ["arq"] }, { hiddenCategories: [categoryKey(wall)] }]) {
      const patch = { ...explicit, isolated: [wall.id], ghost: [wall.id] };
      expect(flags(patch, wall, true, true)).toMatchObject({ visible: false, pickable: false });
      expect(flags(explicit, other).visible).toBe(true);
    }
  });
  it("preserva a simulação em reprodução e a seleção para edição quando pausada", () => {
    expect(flags({ isolated: [wall.id] }, other).visible).toBe(false);
    expect(flags({}, wall, false, true, false).visible).toBe(true);
    expect(flags({ ghost: [wall.id] }, wall, false, true, true).visible).toBe(false);
    expect(flags({ ghost: [other.id] }, wall, false, true, false).visible).toBe(false);
  });
  it("permite Ghost do visualizador, mantém o foco anterior e exclui os translúcidos do clique", () => {
    const teardown = new Set([other.id]);
    expect(flags({ ghost: [wall.id] }, other, true, true, false, teardown)).toEqual({
      visible: true, ghosted: true, emphasized: false, pickable: false,
    });
    expect(flags({}, other, true, false, false, teardown)).toMatchObject({ emphasized: true, pickable: true });
  });
  it("aplica o estado do elemento de origem aos segmentos e normaliza preferências antigas", () => {
    const segment = { ...wall, id: "s1", properties: { ...wall.properties, ParentGlobalId: wall.id } };
    expect(flags({ hidden: [wall.id] }, segment).visible).toBe(false);
    expect(flags({ isolated: [wall.id] }, segment).visible).toBe(true);
    expect(normalizeVisibility()).toBe(EMPTY_VISIBILITY);
    expect(normalizeVisibility({ hidden: [wall.id, wall.id], ghostOpacity: 7 })).toEqual({
      ...EMPTY_VISIBILITY, hidden: [wall.id], ghostOpacity: 0.85,
    });
  });
});

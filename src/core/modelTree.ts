import type { ProjectModel } from "./project";
import type { ModelElement } from "./types";

export interface ModelNode {
  key: string;
  label: string;
  kind: "model" | "spatial" | "category" | "element";
  modelId: string;
  category?: string;
  element?: ModelElement;
  children: ModelNode[];
}

export const modelKey = (id: string) => JSON.stringify(["modelo", id]);
const pathKey = (element: ModelElement) => [element.modelId ?? "", ...(element.spatial ?? []).map((node) => node.id)];
export const categoryKey = (element: ModelElement) => JSON.stringify(["categoria", ...pathKey(element), element.ifcType.toUpperCase()]);

const names: Record<string, string> = {
  IFCWALL: "Paredes", IFCWALLSTANDARDCASE: "Paredes (caso padrão)", IFCSLAB: "Lajes", IFCDOOR: "Portas",
  IFCWINDOW: "Janelas", IFCROOF: "Coberturas", IFCBEAM: "Vigas", IFCCOLUMN: "Pilares",
  IFCFOOTING: "Fundações", IFCPILE: "Estacas", IFCPIPESEGMENT: "Tubulações",
  IFCDUCTSEGMENT: "Dutos", IFCCABLECARRIERSEGMENT: "Eletrocalhas e conduítes", IFCBUILDINGELEMENTPROXY: "Elementos genéricos",
};

export function buildModelTree(elements: ModelElement[], models: ProjectModel[], fallbackName: string): ModelNode[] {
  const roots: ModelNode[] = [];
  const index = new Map<string, ModelNode>();
  const add = (nodes: ModelNode[], node: ModelNode): ModelNode => {
    const known = index.get(node.key);
    if (known) return known;
    nodes.push(node);
    index.set(node.key, node);
    return node;
  };
  for (const file of models) add(roots, { key: modelKey(file.id), modelId: file.id, label: file.name, kind: "model", children: [] });
  for (const element of elements) {
    const modelId = element.modelId ?? "";
    let node = add(roots, { key: modelKey(modelId), modelId, label: fallbackName, kind: "model", children: [] });
    const path = [modelId];
    if (!element.spatial?.length) {
      node = add(node.children, { key: JSON.stringify(["sem-hierarquia", modelId]), modelId, label: "Sem hierarquia IFC informada", kind: "spatial", children: [] });
    }
    for (const group of element.spatial ?? []) {
      path.push(group.id);
      node = add(node.children, { key: JSON.stringify(["espacial", ...path]), modelId, label: group.name, kind: "spatial", children: [] });
    }
    const category = categoryKey(element);
    const type = element.ifcType || "Outros";
    const group = add(node.children, { key: category, modelId, label: names[type.toUpperCase()] ?? type, kind: "category", category, children: [] });
    add(group.children, { key: JSON.stringify(["elemento", element.id]), modelId, label: element.name, kind: "element", element, children: [] });
  }
  return roots;
}

export function modelLeaves(node: ModelNode): ModelElement[] {
  const result: ModelElement[] = [];
  const collect = (item: ModelNode) => {
    if (item.element) result.push(item.element);
    else item.children.forEach(collect);
  };
  collect(node);
  return result;
}

export function modelTreeFilter(nodes: ModelNode[], query: string, system: string) {
  const text = query.trim().toLocaleLowerCase("pt-BR");
  if (!text && !system) return null;
  const visible = new Set<string>();
  const visit = (node: ModelNode, parentMatch: boolean): boolean => {
    const e = node.element;
    const matches = parentMatch || !text || [node.label, e?.ifcType, e?.properties.GlobalId, e?.properties.Tag, ...(e?.systems ?? [])]
      .some((value) => value?.toLocaleLowerCase("pt-BR").includes(text));
    let found = e ? matches && (!system || e.systems?.includes(system)) : false;
    for (const child of node.children) {
      if (visit(child, matches)) found = true;
    }
    if (found) {
      visible.add(node.key);
      return true;
    }
    return false;
  };
  for (const node of nodes) visit(node, false);
  return visible;
}

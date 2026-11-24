import { categoryKey } from "./modelTree";
import type { ModelElement } from "./types";

export interface VisibilitySettings {
  hidden: string[];
  hiddenModels: string[];
  hiddenCategories: string[];
  isolated: string[] | null;
  ghost: string[] | null;
  ghostOpacity: number;
}

export const EMPTY_VISIBILITY: VisibilitySettings = {
  hidden: [], hiddenModels: [], hiddenCategories: [], isolated: null, ghost: null, ghostOpacity: 0.16,
};

export function normalizeVisibility(value?: Partial<VisibilitySettings>): VisibilitySettings {
  if (!value) return EMPTY_VISIBILITY;
  const ids = (list: unknown): string[] => Array.isArray(list) ? [...new Set(list.filter((id): id is string => typeof id === "string"))] : [];
  return {
    hidden: ids(value.hidden), hiddenModels: ids(value.hiddenModels), hiddenCategories: ids(value.hiddenCategories),
    isolated: value.isolated == null ? null : ids(value.isolated),
    ghost: value.ghost == null ? null : ids(value.ghost),
    ghostOpacity: typeof value.ghostOpacity === "number" && Number.isFinite(value.ghostOpacity) ? Math.max(0.05, Math.min(0.85, value.ghostOpacity)) : EMPTY_VISIBILITY.ghostOpacity,
  };
}

export function compileVisibility(settings: VisibilitySettings) {
  return {
    hidden: new Set(settings.hidden), models: new Set(settings.hiddenModels), categories: new Set(settings.hiddenCategories),
    isolated: settings.isolated === null ? null : new Set(settings.isolated),
    ghost: settings.ghost === null ? null : new Set(settings.ghost),
    ghostOpacity: settings.ghostOpacity,
  };
}

export type Inspection = ReturnType<typeof compileVisibility>;
export interface ElementVisibilityKey { model: string; category: string; parent?: string }

export const elementVisibilityKey = (element: ModelElement): ElementVisibilityKey => ({
  model: element.modelId ?? "", category: categoryKey(element), parent: element.properties.ParentGlobalId,
});

const includes = (set: Set<string>, id: string, parent?: string) => set.has(id) || (parent !== undefined && set.has(parent));

export function explicitlyHidden(inspection: Inspection, id: string, element?: ElementVisibilityKey): boolean {
  return inspection.models.has(element?.model ?? "") || (!!element && inspection.categories.has(element.category)) ||
    includes(inspection.hidden, id, element?.parent);
}

export function displayElement(
  inspection: Inspection, id: string, key: ElementVisibilityKey | undefined,
  scheduledVisible: boolean, selected: boolean, playing: boolean, focus: Set<string> | null,
) {
  const allowed = !explicitlyHidden(inspection, id, key) && (!inspection.isolated || includes(inspection.isolated, id, key?.parent));
  const focusSet = inspection.ghost ?? focus;
  const emphasized = focusSet ? includes(focusSet, id, key?.parent) : false;
  const ghosted = focusSet !== null && !emphasized;
  const visible = allowed && (scheduledVisible || (selected && !playing && !ghosted));
  return { visible, ghosted, emphasized, pickable: visible && !ghosted };
}

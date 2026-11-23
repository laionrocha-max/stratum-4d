// Project manifests refer to immutable model files in a local asset store.

import { normalizePresentation, type CameraState, type Presentation, type ViewSettings } from "./presentation";
import { DEFAULT_PROFILES, localizeDefaultProfiles } from "./profiles";
import type { SimulationOptions } from "./simulation";
import type { AppearanceProfile, ElementGroup, ElementSegment, Link, LinkRule, MotionPath, Schedule } from "./types";

export const PROJECT_FORMAT = "stratum-project";
export const PROJECT_VERSION = 4;

export interface ProjectModel {
  /** Empty only for the first model migrated from an unqualified legacy file. */
  id: string;
  name: string;
  hash?: string;
  size?: number;
  revision?: number;
}

export interface ModelManifest {
  files: ProjectModel[];
  /** Shared IFC-to-scene transform, kept stable across revisions. */
  coordination?: number[];
}

export interface RevisionSource {
  name: string;
  hash?: string;
}

export interface ProjectRevision {
  id: string;
  kind: "ifc" | "schedule" | "restore";
  date: string;
  author: string;
  source: RevisionSource;
  dataDate: number | null;
  checkpoint: string;
  summary: string;
  number?: number;
}

export interface StratumProject {
  format: typeof PROJECT_FORMAT;
  version: number;
  savedAt: string;
  modelFileName: string | null;
  projectKey?: string;
  title?: string;
  archived?: boolean;
  models?: ModelManifest;
  scheduleSource?: RevisionSource;
  revisions?: ProjectRevision[];
  simulation?: SimulationOptions;
  view?: { camera?: CameraState; settings: ViewSettings; time: number };
  schedule: Schedule | null;
  links: Link[];
  rules: LinkRule[];
  profiles: AppearanceProfile[];
  segments?: ElementSegment[];
  groups?: ElementGroup[];
  paths?: MotionPath[];
  /** Viewpoints and animations. */
  presentation?: Presentation;
}

export function serializeProject(p: Omit<StratumProject, "format" | "version" | "savedAt">): string {
  const doc: StratumProject = { format: PROJECT_FORMAT, version: PROJECT_VERSION, savedAt: new Date().toISOString(), ...p };
  return JSON.stringify(doc, null, 2);
}

export function parseProject(text: string): StratumProject {
  return normalizeProject(JSON.parse(text));
}

export function normalizeProject(doc: Partial<StratumProject> & { ifcAssembly?: ModelManifest }): StratumProject {
  if (doc?.format !== PROJECT_FORMAT) throw new Error("Este arquivo não é um projeto do STRATUM.");
  if ((doc.version ?? 0) > PROJECT_VERSION) throw new Error(`O projeto v${doc.version} precisa de uma versão mais recente do STRATUM.`);
  const models = doc.models ?? doc.ifcAssembly;
  if (models) {
    if (!Array.isArray(models.files) || models.files.some((m) =>
      !m || typeof m.id !== "string" || m.id.includes(":") || typeof m.name !== "string" || !m.name ||
      (m.hash !== undefined && !/^[0-9a-f]{64}$/.test(m.hash)),
    ) || new Set(models.files.map((m) => m.id)).size !== models.files.length) {
      throw new Error("O projeto contém referências de modelos inválidas ou duplicadas.");
    }
    if (models.coordination && (!Array.isArray(models.coordination) || models.coordination.length !== 16 || !models.coordination.every(Number.isFinite))) {
      throw new Error("O projeto contém uma transformação IFC inválida.");
    }
  }
  const camera = doc.view?.camera;
  const isVector = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  if (camera && (!isVector(camera.pos) || !isVector(camera.target) || !Number.isFinite(camera.fov) || camera.fov <= 0 || camera.fov >= 180)) {
    throw new Error("O projeto contém uma câmera inválida.");
  }
  return {
    format: PROJECT_FORMAT,
    version: doc.version ?? PROJECT_VERSION,
    savedAt: doc.savedAt ?? "",
    modelFileName: doc.modelFileName ?? null,
    projectKey: doc.projectKey,
    title: doc.title,
    archived: doc.archived,
    models,
    scheduleSource: doc.scheduleSource,
    revisions: Array.isArray(doc.revisions) ? doc.revisions.filter((r) => r && typeof r.id === "string" && /^[0-9a-f]{64}$/.test(r.checkpoint)) : undefined,
    simulation: doc.simulation,
    view: doc.view,
    schedule: doc.schedule ?? null,
    links: Array.isArray(doc.links) ? doc.links : [],
    rules: Array.isArray(doc.rules) ? doc.rules : [],
    profiles: Array.isArray(doc.profiles) && doc.profiles.length ? localizeDefaultProfiles(doc.profiles) : structuredClone(DEFAULT_PROFILES),
    segments: Array.isArray(doc.segments) ? doc.segments : [],
    groups: Array.isArray(doc.groups) ? doc.groups : [],
    paths: Array.isArray(doc.paths) ? doc.paths : [],
    presentation: normalizePresentation(doc.presentation),
  };
}

export const modelElementKey = (modelId: string, elementId: string) => modelId ? `${modelId}:${elementId}` : elementId;

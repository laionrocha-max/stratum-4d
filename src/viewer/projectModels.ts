import type * as THREE from "three";
import { getModelAsset } from "../backend/modelAssets";
import { modelElementKey, type ModelManifest, type ProjectModel } from "../core/project";
import type { ModelElement } from "../core/types";
import { MESH_FORMATS } from "./meshLoader";

export interface ModelPart {
  elements: ModelElement[];
  objects: Map<string, THREE.Object3D>;
  coordination?: number[];
  geographicReference?: string;
  location?: { latitude: number; longitude: number; north?: number };
}

export async function loadModelPart(model: ProjectModel, buffer: ArrayBuffer, coordination?: number[]): Promise<ModelPart> {
  const bytes = new Uint8Array(buffer);
  const geometry = MESH_FORMATS.test(model.name)
    ? await (await import("./meshLoader")).loadMeshModel(model.name, bytes)
    : await (await import("./ifcLoader")).loadIfc(bytes, undefined, coordination);
  if (!geometry.elements.length) throw new Error("O modelo não contém geometria 3D utilizável.");
  const key = (id: string) => modelElementKey(model.id, id);
  return {
    elements: geometry.elements.map((e) => ({
      ...e,
      id: key(e.id),
      modelId: model.id,
      properties: { ...e.properties, "Arquivo do modelo": model.name, ...(/\.ifc$/i.test(model.name) ? { "Arquivo IFC": model.name } : {}), GlobalId: e.id,
        ...(e.systems?.length ? { "Sistema IFC": e.systems.join(", ") } : {}) },
    })),
    objects: new Map(Array.from(geometry.objects, ([id, object]) => [key(id), object])),
    coordination: "coordination" in geometry ? geometry.coordination : undefined,
    geographicReference: "geographicReference" in geometry ? geometry.geographicReference : undefined,
    location: "location" in geometry ? geometry.location : undefined,
  };
}

export function combineModelParts(parts: Iterable<ModelPart>): ModelPart {
  const elements: ModelElement[] = [];
  const objects = new Map<string, THREE.Object3D>();
  for (const part of parts) {
    for (const e of part.elements) elements.push(e);
    for (const [id, object] of part.objects) objects.set(id, object);
  }
  return { elements, objects };
}

export function disposeModelParts(parts: Iterable<Pick<ModelPart, "objects">>) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const part of parts) for (const object of part.objects.values()) {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => materials.add(material));
      else if (mesh.material) materials.add(mesh.material);
    });
  }
  const textures = new Set<THREE.Texture>();
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export async function restoreModelParts(manifest: ModelManifest, isCurrent: () => boolean) {
  const parts = new Map<string, ModelPart>();
  const missing: ProjectModel[] = [];
  let coordination = manifest.coordination;
  for (const file of manifest.files) {
    if (!isCurrent()) break;
    try {
      const asset = file.hash ? await getModelAsset(file.hash) : undefined;
      if (!asset || (file.size !== undefined && asset.size !== file.size)) {
        missing.push(file);
        continue;
      }
      const part = await loadModelPart(file, await asset.arrayBuffer(), coordination);
      coordination ??= part.coordination;
      parts.set(file.id, part);
    } catch {
      missing.push(file);
    }
  }
  return { parts, missing, manifest: { files: manifest.files, coordination } };
}

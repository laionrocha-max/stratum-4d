// IFC loading with web-ifc (open source, MPL-2.0). Produces one three.js mesh
// group per IFC product plus the element metadata the linking engine needs.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as WebIFC from "web-ifc";
import type { ModelElement } from "../core/types";

export interface LoadedGeometry {
  elements: ModelElement[];
  objects: Map<string, THREE.Object3D>;
}

export interface LoadedIfc extends LoadedGeometry {
  coordination: number[];
  geographicReference: string;
  location?: { latitude: number; longitude: number; north?: number };
}

let api: WebIFC.IfcAPI | null = null;

async function getApi(): Promise<WebIFC.IfcAPI> {
  if (api) return api;
  const a = new WebIFC.IfcAPI();
  a.SetWasmPath(new URL("./", document.baseURI).href, true);
  await a.Init();
  api = a;
  return a;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) return String((v as { value: unknown }).value ?? "");
  return String(v);
}

function compoundAngle(field: { value?: unknown } | undefined): number | null {
  const parts = field?.value;
  if (!Array.isArray(parts) || parts.length < 3 || parts.length > 4 || !parts.every(Number.isFinite)) return null;
  const [degrees, minutes, seconds, millionths = 0] = parts.map(Math.abs);
  if (minutes >= 60 || seconds >= 60 || millionths >= 1e6) return null;
  return Math.sign(parts.find((part) => part !== 0) ?? 1) * (degrees + minutes / 60 + (seconds + millionths / 1e6) / 3600);
}

function siteLocation(ifc: WebIFC.IfcAPI, modelID: number): LoadedIfc["location"] {
  const sites = ifc.GetLineIDsWithType(modelID, WebIFC.IFCSITE);
  for (let i = 0; i < sites.size(); i++) {
    const site = ifc.GetLine(modelID, sites.get(i));
    const latitude = compoundAngle(site?.RefLatitude);
    const longitude = compoundAngle(site?.RefLongitude);
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) continue;
    const contexts = ifc.GetLineIDsWithType(modelID, WebIFC.IFCGEOMETRICREPRESENTATIONCONTEXT);
    for (let j = 0; j < contexts.size(); j++) {
      const context = ifc.GetLine(modelID, contexts.get(j));
      if (!context?.TrueNorth?.value) continue;
      const direction = ifc.GetLine(modelID, context.TrueNorth.value)?.DirectionRatios;
      if (Array.isArray(direction) && Number.isFinite(direction[0]) && Number.isFinite(direction[1])) {
        return { latitude, longitude, north: Math.atan2(direction[0], direction[1]) * 180 / Math.PI };
      }
    }
    return { latitude, longitude };
  }
}

export async function loadIfc(bytes: Uint8Array, onProgress?: (msg: string) => void, coordination?: number[]): Promise<LoadedIfc> {
  const ifc = await getApi();
  onProgress?.("Opening model…");
  const modelID = ifc.OpenModel(bytes, { COORDINATE_TO_ORIGIN: !coordination });
  const objects = new Map<string, THREE.Object3D>();
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  try {
    if (coordination) ifc.SetGeometryTransformation(modelID, coordination);
    const expressToKey = new Map<number, string>();
    const elements: ModelElement[] = [];
    const duplicates = new Set<string>();

    onProgress?.("Reading geometry…");
    let streamed = 0;
    ifc.StreamAllMeshes(modelID, (mesh) => {
      const group = new THREE.Group();
      // Geometry pieces of one element, grouped by material so each element
      // becomes one mesh per colour instead of one mesh per IFC representation.
      const pieces = new Map<THREE.MeshLambertMaterial, THREE.BufferGeometry[]>();
      const placed = mesh.geometries;
      for (let i = 0; i < placed.size(); i++) {
        const pg = placed.get(i);
        const geom = ifc.GetGeometry(modelID, pg.geometryExpressID);
        const verts = ifc.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
        const index = ifc.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
        const pos = new Float32Array(verts.length / 2);
        const nor = new Float32Array(verts.length / 2);
        for (let v = 0, k = 0; v < verts.length; v += 6, k += 3) {
          pos[k] = verts[v];
          pos[k + 1] = verts[v + 1];
          pos[k + 2] = verts[v + 2];
          nor[k] = verts[v + 3];
          nor[k + 1] = verts[v + 4];
          nor[k + 2] = verts[v + 5];
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        g.setIndex(new THREE.BufferAttribute(index, 1));
        g.applyMatrix4(new THREE.Matrix4().fromArray(pg.flatTransformation));
        geom.delete();
        const c = pg.color;
        const key = `${c.x.toFixed(3)}|${c.y.toFixed(3)}|${c.z.toFixed(3)}|${c.w.toFixed(3)}`;
        let mat = materials.get(key);
        if (!mat) {
          mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(c.x, c.y, c.z), transparent: c.w < 1, opacity: c.w, side: THREE.DoubleSide });
          materials.set(key, mat);
        }
        (pieces.get(mat) ?? pieces.set(mat, []).get(mat)!).push(g);
      }
      for (const [mat, geoms] of pieces) {
        const merged = geoms.length > 1 ? mergeGeometries(geoms, false) : geoms[0];
        if (merged) {
          if (geoms.length > 1) geoms.forEach((x) => x.dispose());
          group.add(new THREE.Mesh(merged, mat));
        } else geoms.forEach((x) => group.add(new THREE.Mesh(x, mat)));
      }
      if (++streamed % 2000 === 0) onProgress?.(`Reading geometry… ${streamed} elements`);
      const line = ifc.GetLine(modelID, mesh.expressID);
      const key = str(line?.GlobalId) || `express-${mesh.expressID}`;
      if (objects.has(key)) {
        duplicates.add(key);
        for (const mesh of group.children as THREE.Mesh[]) mesh.geometry.dispose();
        return;
      }
      group.userData.elementId = key;
      objects.set(key, group);
      expressToKey.set(mesh.expressID, key);
    });
    if (duplicates.size) throw new Error(`IFC com ${duplicates.size} GlobalId(s) duplicado(s). Corrija os IDs no modelo de origem: ${[...duplicates].slice(0, 4).join(", ")}`);

    onProgress?.(`Reading properties for ${objects.size} elements…`);
    const spatial = await spatialStructure(ifc, modelID);
    let n = 0;
    for (const [expressID, key] of expressToKey) {
      const line = ifc.GetLine(modelID, expressID);
      const typeCode = ifc.GetLineType(modelID, expressID);
      const props: Record<string, string> = {};
      const tag = str(line?.Tag);
      if (tag) props.Tag = tag;
      const objType = str(line?.ObjectType);
      if (objType) props.ObjectType = objType;
      const place = spatial.get(expressID);
      if (place?.storey) props.Storey = place.storey;
      if (place?.path) props.SpatialPath = place.path;
      try {
        const psets = await ifc.properties.getPropertySets(modelID, expressID, true);
        for (const ps of psets ?? []) {
          const psName = str(ps?.Name) || "Pset";
          for (const p of ps?.HasProperties ?? []) {
            const pName = str(p?.Name);
            const val = str(p?.NominalValue);
            if (pName && val) props[`${psName}.${pName}`] = val;
          }
          for (const q of ps?.Quantities ?? []) {
            const qName = str(q?.Name);
            const val = str(q?.LengthValue ?? q?.AreaValue ?? q?.VolumeValue ?? q?.CountValue ?? q?.WeightValue);
            if (qName && val) props[`${psName}.${qName}`] = val;
          }
        }
      } catch {
        // Some elements have malformed property links; keep the basics.
      }
      elements.push({
        id: key,
        expressId: expressID,
        ifcType: ifc.GetNameFromTypeCode(typeCode) || String(typeCode),
        name: str(line?.Name) || `#${expressID}`,
        properties: props,
      });
      if (++n % 500 === 0) onProgress?.(`Reading properties… ${n}/${expressToKey.size}`);
    }
    const conversions = ifc.GetLineIDsWithType(modelID, WebIFC.IFCMAPCONVERSION);
    const reference = [];
    for (let i = 0; i < conversions.size(); i++) {
      const m = ifc.GetLine(modelID, conversions.get(i));
      const target = m?.TargetCRS?.value;
      const crs = typeof target === "number" ? ifc.GetLine(modelID, target) : undefined;
      reference.push([str(crs?.Name), ...["Eastings", "Northings", "OrthogonalHeight", "XAxisAbscissa", "XAxisOrdinate", "Scale"].map((k) => str(m?.[k]))].join("|"));
    }
    return { elements, objects, coordination: coordination ?? ifc.GetCoordinationMatrix(modelID), geographicReference: reference.sort().join(";"), location: siteLocation(ifc, modelID) };
  } catch (error) {
    for (const object of objects.values()) for (const mesh of object.children as THREE.Mesh[]) mesh.geometry.dispose();
    for (const material of materials.values()) material.dispose();
    throw error;
  } finally {
    ifc.CloseModel(modelID);
  }
}

interface SpatialNode {
  expressID: number;
  type: string;
  children: SpatialNode[];
}

async function spatialStructure(ifc: WebIFC.IfcAPI, modelID: number) {
  const out = new Map<number, { storey: string | null; path: string }>();
  const spatialTypes = new Set(["IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCSPACE"]);
  try {
    const root = (await ifc.properties.getSpatialStructure(modelID)) as unknown as SpatialNode;
    const walk = (node: SpatialNode, storey: string | null, path: string) => {
      const type = String(node.type).toUpperCase();
      if (path) out.set(node.expressID, { storey, path });
      if (spatialTypes.has(type)) {
        const line = ifc.GetLine(modelID, node.expressID);
        const name = str(line?.Name) || type;
        path = [path, `${type} ${name} [${str(line?.GlobalId)}]`].filter(Boolean).join(" / ");
        if (type === "IFCBUILDINGSTOREY") storey = name;
      }
      for (const c of node.children ?? []) walk(c, storey, path);
    };
    walk(root, null, "");
  } catch {
    // Spatial structure is optional.
  }
  return out;
}

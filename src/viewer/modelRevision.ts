import { Box3, Vector3, type BufferGeometry, type Mesh, type Object3D } from "three";
import type { ModelPart } from "./projectModels";

const stable = (key: string) => !/(?:^|:)express-\d+$/.test(key);
const tolerance = 0.001;
const matchesArray = (a: ArrayLike<number> | undefined, b: ArrayLike<number> | undefined, tolerance = 0) => {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > tolerance) return false;
  return true;
};

function geometries(object: Object3D): BufferGeometry[] {
  const result: BufferGeometry[] = [];
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.isMesh) result.push(mesh.geometry);
  });
  return result;
}

function center(parts: BufferGeometry[]) {
  const box = new Box3();
  for (const part of parts) {
    if (!part.boundingBox) part.computeBoundingBox();
    if (part.boundingBox) box.union(part.boundingBox);
  }
  return box.getCenter(new Vector3());
}

/** IFC loaders bake placement and federation matrices into vertex coordinates.
 * Comparing those arrays avoids treating playback motion as a design revision. */
export function compareModelRevision(before: ModelPart, after: ModelPart) {
  const old = new Map(before.elements.map((element) => [element.id, element]));
  const next = new Map(after.elements.map((element) => [element.id, element]));
  const removed = before.elements.filter((e) => !stable(e.id) || !next.has(e.id));
  const added = after.elements.filter((e) => !stable(e.id) || !old.has(e.id));
  const changed: { id: string; label: string; fields: string[] }[] = [];
  const translations = new Map<string, number>();
  let matched = 0;
  for (const item of after.elements) {
    const prev = old.get(item.id);
    if (!stable(item.id) || !prev) continue;
    matched++;
    const a = geometries(before.objects.get(prev.id)!);
    const b = geometries(after.objects.get(item.id)!);
    const fields: string[] = [];
    if (item.name !== prev.name || item.ifcType !== prev.ifcType) fields.push("Nome/classe");
    if (prev.properties.SpatialPath !== item.properties.SpatialPath || prev.properties.Storey !== item.properties.Storey) fields.push("Hierarquia");
    const sameGeometry = a.length === b.length && a.every((part, i) =>
      matchesArray(part.getAttribute("position")?.array, b[i].getAttribute("position")?.array, 0.00001) &&
      matchesArray(part.getIndex()?.array, b[i].getIndex()?.array),
    );
    if (!sameGeometry) {
      fields.push("Geometria ou posição");
      const delta = center(b).sub(center(a));
      if (delta.length() > tolerance) {
        const key = delta.toArray().map((value) => Math.round(value / tolerance)).join("|");
        translations.set(key, (translations.get(key) ?? 0) + 1);
      }
    }
    if (fields.length) changed.push({ id: item.id, label: item.name, fields });
  }
  const translated = [...translations.values()].some((n) => n >= 2 && n / matched >= 0.7);
  return { added, removed, changed, matched, translated, georeferenceChanged: before.geographicReference !== after.geographicReference };
}

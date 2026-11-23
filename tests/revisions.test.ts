import { readFileSync } from "node:fs";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { assignBaseline } from "../src/core/baseline";
import { parseMspdi } from "../src/core/mspdi";
import type { Link, ModelElement, MotionPath } from "../src/core/types";
import { applyScheduleRevision, planScheduleRevision, remapLinks } from "../src/core/update";
import { compareModelRevision } from "../src/viewer/modelRevision";
import type { ModelPart } from "../src/viewer/projectModels";

const original = parseMspdi(readFileSync("samples/demo-msproject.xml", "utf8"));
const first = original.activities[0];
const link: Link = { elementId: "model:wall", activityId: first.id, profileId: "install" };
const path: MotionPath = { id: "path", name: "Path", activityId: first.id, elementIds: ["model:wall"], points: [[0, 0, 0], [1, 0, 0]], orient: false };

describe("schedule revision preflight", () => {
  it("matches changed internal IDs, detects renamed work and preserves frozen baseline dates", () => {
    const incoming = {
      ...original,
      dataDate: original.dataDate! + 86_400_000,
      activities: original.activities.map((a) => ({
        ...a, id: `rev-${a.id}`, name: a.id === first.id ? "Revised wall" : a.name,
        actualStart: null, remainingDurationHours: 12, baselineStart: 1, baselineFinish: 2,
      })),
      relationships: original.relationships.map((r) => ({ ...r, predecessorId: `rev-${r.predecessorId}`, successorId: `rev-${r.successorId}` })),
    };
    const plan = planScheduleRevision(original, incoming);
    expect(plan.matches.get(first.id)).toBe(`rev-${first.id}`);
    expect(plan.diff.changed[0].fields).toContain("Nome");
    expect(plan.diff.changed[0].fields).toContain("Datas reais");
    expect(plan.diff.relationshipsChanged).toBe(false);
    const updated = applyScheduleRevision(original, incoming, [link], [path], plan.matches);
    expect(updated.links[0].activityId).toBe(`rev-${first.id}`);
    expect(updated.paths[0].activityId).toBe(`rev-${first.id}`);
    expect(updated.schedule.activities[0].baselineStart).toBe(first.baselineStart);
    expect(updated.schedule.activities[0].baselineFinish).toBe(first.baselineFinish);
    expect(original.activities[0]).toEqual(first);
  });

  it("rejects duplicated codes for both revision and explicit baseline assignment", () => {
    const incoming = { ...original, activities: [...original.activities, { ...first, id: "duplicate" }] };
    expect(() => planScheduleRevision(original, incoming)).toThrow(/duplicados/);
    expect(() => assignBaseline(original, incoming)).toThrow(/ambíguos/);
    expect(remapLinks(original, incoming, [link])).toEqual({ links: [], dropped: [link] });
  });

  it("reports a removed linked activity and makes a changed MS Project ordinal explicit", () => {
    const incoming = { ...original, activities: original.activities.slice(1) };
    const plan = planScheduleRevision(original, incoming);
    expect(plan.diff.removed.map((a) => a.code)).toContain(first.code);
    expect(applyScheduleRevision(original, incoming, [link], [path], plan.matches)).toMatchObject({ links: [], orphaned: [link], paths: [] });
    const renumbered = { ...original, activities: [{ ...first, code: "T100" }, ...original.activities.slice(1)] };
    expect(planScheduleRevision(original, renumbered).ambiguous.has(first.id)).toBe(true);
    expect(() => planScheduleRevision(original, { ...incoming, projectCode: "Another", projectId: "another" })).toThrow(/mesmo cronograma/);
    expect(() => planScheduleRevision(
      { ...original, projectId: "{5c6b4531-68b6-42d1-b66a-94e2ab526878}" },
      { ...incoming, projectId: "{6c6b4531-68b6-42d1-b66a-94e2ab526878}" },
    )).toThrow(/mesmo cronograma/);
  });
});

function part(items: [string, number, number, string][], geographicReference = ""): ModelPart {
  const material = new MeshBasicMaterial();
  return {
    geographicReference,
    elements: items.map(([id, , , floor], i): ModelElement => ({ id, name: id, expressId: i, ifcType: "IfcWall", properties: { SpatialPath: floor } })),
    objects: new Map(items.map(([id, x, width]) => [id, new Mesh(new BoxGeometry(width, 1, 1).translate(x, 0, 0), material)])),
  };
}

describe("IFC revision preflight", () => {
  it("distinguishes geometry, hierarchy, changed IDs and a common coordinate shift", () => {
    const before = part([["wall1", 1, 1, "A"], ["wall2", 2, 1, "A"], ["wall3", 3, 1, "A"], ["old", 4, 1, "A"]], "Old CRS");
    const after = part([["wall1", 11, 2, "B"], ["wall2", 12, 1, "A"], ["wall3", 13, 1, "A"], ["new", 14, 1, "A"]], "New CRS");
    const diff = compareModelRevision(before, after);
    expect(diff.matched).toBe(3);
    expect(diff.changed[0].fields).toEqual(["Hierarquia", "Geometria ou posição"]);
    expect(diff.removed[0].id).toBe("old");
    expect(diff.added[0].id).toBe("new");
    expect(diff.translated).toBe(true);
    expect(diff.georeferenceChanged).toBe(true);
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { modelElementKey, normalizeProject, parseProject, PROJECT_FORMAT, PROJECT_VERSION, type StratumProject } from "../src/core/project";
import { Repository, VersionConflictError } from "../src/services/repo";
import { openSqlite } from "../src/services/sql";

const project: StratumProject = {
  format: PROJECT_FORMAT, version: PROJECT_VERSION, savedAt: "", title: "Obra A",
  projectKey: "obra-a", modelFileName: "arquitetura.ifc", schedule: null, rules: [], profiles: [],
  links: [{ elementId: "arch:global-id", activityId: "1", profileId: "install" }],
  models: { files: [{ id: "arch", name: "arquitetura.ifc", hash: "c".repeat(64), size: 42, revision: 1 }] },
};

describe("isolated project records", () => {
  it("reads a version 2 federation without changing previously linked element keys", () => {
    const legacy = {
      ...project,
      models: undefined,
      version: 2,
      ifcAssembly: { files: [{ id: "", name: "old.ifc" }, { id: "struct", name: "struct.ifc" }] },
      links: [{ elementId: "struct:guid", activityId: "2", profileId: "install" }],
    };
    const restored = parseProject(JSON.stringify(legacy));
    expect(restored.models).toEqual(legacy.ifcAssembly);
    expect(restored.links).toEqual(legacy.links);
    expect(modelElementKey("", "guid")).toBe("guid");
    expect(modelElementKey("struct", "guid")).not.toBe(modelElementKey("arch", "guid"));
  });

  it("rejects corrupt manifests before any scene changes", () => {
    const model = project.models!.files[0];
    expect(() => normalizeProject({ ...project, models: { files: [model, model] } })).toThrow(/duplicad/);
    expect(() => normalizeProject({ ...project, models: { files: [{ ...model, hash: "../bad" }] } })).toThrow(/inválid/);
    expect(() => normalizeProject({ ...project, models: { files: [model], coordination: [1, 2] } })).toThrow(/transformação/);
  });

  it("commits only one write from the same version and persistently records which project is archived", async () => {
    const folder = await mkdtemp(join(tmpdir(), "stratum-projects-"));
    const file = join(folder, "projects.sqlite");
    let repo = new Repository(await openSqlite(file));
    try {
      await repo.migrate();
      await repo.saveProject("a", project);
      await repo.saveProject("b", { ...project, projectKey: "obra-b", title: "Obra B" });
      const contenders = await Promise.allSettled([
        repo.saveProject("a", { ...project, archived: true }, { expectedVersion: 1 }),
        repo.saveProject("a", { ...project, archived: true }, { expectedVersion: 1 }),
      ]);
      expect(contenders.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(contenders.find((r) => r.status === "rejected")).toMatchObject({ reason: expect.any(VersionConflictError) });
      await repo.close();
      repo = new Repository(await openSqlite(file));
      await repo.migrate();
      const saved = await repo.getProject("a");
      expect(saved?.version).toBe(2);
      expect(saved?.project.models).toEqual(project.models);
      expect((await repo.listProjects()).find((p) => p.id === "a")).toMatchObject({ name: "Obra A", archived: true });
      expect((await repo.listProjects()).find((p) => p.id === "b")?.archived).toBeUndefined();
      await repo.deleteProject("a");
      await expect(repo.saveProject("a", project, { expectedVersion: 2 })).rejects.toThrow(VersionConflictError);
      expect(await repo.getProject("b")).not.toBeNull();
    } finally {
      await repo.close();
      await rm(folder, { force: true, recursive: true });
    }
  });
});

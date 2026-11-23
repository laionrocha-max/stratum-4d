import { describe, expect, it } from "vitest";
import { modelHash } from "../src/backend/modelAssets";
import { createProjectBackup, readProjectBackup } from "../src/backend/projectBackup";
import { PROJECT_FORMAT, PROJECT_VERSION, type StratumProject } from "../src/core/project";
import { DEFAULT_PROFILES } from "../src/core/profiles";

async function fixture() {
  const stored = new Map<string, Blob>();
  const put = async (value: string) => {
    const file = new Blob([value]);
    const hash = await modelHash(await file.arrayBuffer());
    stored.set(hash, file);
    return hash;
  };
  const original = await put("IFC original");
  const current = await put("IFC revisão");
  const structure = await put("IFC de estrutura");
  const xml = await put("<Project/>");
  const project: StratumProject = {
    format: PROJECT_FORMAT, version: PROJECT_VERSION, savedAt: "", title: "Piscina", projectKey: "piscina",
    modelFileName: "arquitetura.ifc", schedule: null, profiles: DEFAULT_PROFILES, rules: [],
    links: [{ elementId: "arq:global-id", activityId: "2", profileId: "install" }],
    models: { files: [{ id: "arq", name: "arquitetura.ifc", hash: current }, { id: "est", name: "estrutura.ifc", hash: structure }] },
    scheduleSource: { name: "obra.xml", hash: xml },
  };
  const previous = { ...project, models: { files: [{ id: "arq", name: "arquitetura.ifc", hash: original }, project.models!.files[1]] } };
  const checkpoint = await put(JSON.stringify(previous));
  project.revisions = [{
    id: "r2", kind: "ifc", date: "2026-11-23", author: "Local", summary: "Revisão IFC",
    source: { name: "arquitetura.ifc", hash: current }, dataDate: null, checkpoint,
  }];
  return { project, original, checkpoint, stored, load: async (hash: string) => stored.get(hash) };
}

describe("cópia de segurança de obra", () => {
  it("transporta os dois modelos, o cronograma de origem e os arquivos da versão anterior", async () => {
    const { project, stored, load, checkpoint, original } = await fixture();
    const backup = await createProjectBackup(project, load);
    const result = await readProjectBackup(backup);
    expect(result.project.links).toEqual(project.links);
    expect(result.project.revisions).toEqual(project.revisions);
    expect(result.project.models).toEqual(project.models);
    expect(result.assets.size).toBe(stored.size);
    expect(await result.assets.get(original)?.text()).toBe("IFC original");
    expect(JSON.parse(await result.assets.get(checkpoint)!.text()).models.files[0].hash).toBe(original);
  });

  it("recusa exportar uma cópia quando o IFC de uma revisão anterior não existe", async () => {
    const { project, stored, load, original } = await fixture();
    stored.delete(original);
    await expect(createProjectBackup(project, load)).rejects.toThrow(/arquitetura.ifc/);
  });

  it("recusa conteúdo alterado e arquivo truncado", async () => {
    const { project, load } = await fixture();
    const backup = await createProjectBackup(project, load);
    const truncated = backup.slice(0, backup.size - 1);
    await expect(readProjectBackup(truncated)).rejects.toThrow();
    const corrupted = new Blob([truncated, new Uint8Array([0])]);
    await expect(readProjectBackup(corrupted)).rejects.toThrow(/integridade/);
  });

  it("avisa quando o IFC de um manifesto antigo precisa ser localizado", async () => {
    const { project, load } = await fixture();
    await expect(createProjectBackup({ ...project, models: undefined }, load)).rejects.toThrow(/arquitetura.ifc/);
  });
});

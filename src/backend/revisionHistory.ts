import { getModelAsset, modelHash, saveModelAsset } from "./modelAssets";
import { parseProject, type StratumProject } from "../core/project";

export async function saveCheckpoint(project: StratumProject): Promise<string> {
  const { revisions: _journal, ...snapshot } = project;
  const file = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
  const hash = await modelHash(await file.arrayBuffer());
  await saveModelAsset(hash, file);
  return hash;
}

export async function readCheckpoint(hash: string): Promise<StratumProject> {
  const file = await getModelAsset(hash);
  if (!file) throw new Error("A cópia anterior está indisponível neste perfil. Abra o histórico no perfil em que a revisão foi feita.");
  return parseProject(await file.text());
}

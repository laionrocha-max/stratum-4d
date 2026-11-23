import { parseProject, type StratumProject } from "../core/project";
import { sampleKindOf } from "../core/samples";
import { modelHash } from "./modelAssets";

// A versioned UTF-8 directory followed by raw file bytes. Blob slices keep
// the archive separate from the memory needed to hash or load a single IFC.
const MAGIC = new TextEncoder().encode("STRATUM-BACKUP-1\n");
const HASH_START = MAGIC.length + 4;
const PREFIX_SIZE = HASH_START + 32;
const HASH = /^[a-f0-9]{64}$/;

type ReadAsset = (hash: string) => Promise<Blob | undefined>;
interface AssetEntry { hash: string; size: number }

async function collectAssets(project: StratumProject, read: ReadAsset) {
  const assets = new Map<string, Blob>();
  const checkedSnapshots = new Set<string>();
  const pending = [project];
  const load = async (hash: string, name: string, size?: number) => {
    if (!HASH.test(hash)) throw new Error(`Referência inválida para ${name}.`);
    const existing = assets.get(hash);
    const blob = existing ?? await read(hash);
    if (!blob) throw new Error(`Arquivo indisponível: ${name}.`);
    if ((size !== undefined && size !== blob.size) || (!existing && await modelHash(await blob.arrayBuffer()) !== hash)) {
      throw new Error(`A verificação de integridade falhou para ${name}.`);
    }
    assets.set(hash, blob);
    return blob;
  };
  while (pending.length) {
    const current = pending.pop()!;
    if (current.modelFileName && !current.models && !sampleKindOf(current.modelFileName)) {
      throw new Error(`Localize o arquivo ${current.modelFileName} antes de gerar uma cópia completa.`);
    }
    for (const file of current.models?.files ?? []) {
      if (!file.hash) throw new Error(`Localize o arquivo ${file.name} antes de gerar uma cópia completa.`);
      await load(file.hash, file.name, file.size);
    }
    if (current.scheduleSource?.hash) await load(current.scheduleSource.hash, current.scheduleSource.name);
    for (const revision of current.revisions ?? []) {
      if (revision.source?.hash) await load(revision.source.hash, revision.source.name);
      if (checkedSnapshots.has(revision.checkpoint)) continue;
      checkedSnapshots.add(revision.checkpoint);
      const blob = await load(revision.checkpoint, `estado anterior de ${revision.source?.name ?? revision.id}`);
      pending.push(parseProject(await blob.text()));
    }
  }
  return assets;
}

export async function createProjectBackup(project: StratumProject, read: ReadAsset): Promise<Blob> {
  const assets = await collectAssets(project, read);
  const directory: AssetEntry[] = [...assets].map(([hash, blob]) => ({ hash, size: blob.size }));
  const header = new TextEncoder().encode(JSON.stringify({ project, assets: directory }));
  if (header.byteLength > 0xffffffff) throw new Error("O manifesto excede o tamanho do formato de cópia.");
  const prefix = new Uint8Array(PREFIX_SIZE);
  prefix.set(MAGIC);
  new DataView(prefix.buffer).setUint32(MAGIC.length, header.byteLength, true);
  prefix.set(new Uint8Array(await crypto.subtle.digest("SHA-256", header)), HASH_START);
  return new Blob([prefix, header, ...assets.values()], { type: "application/octet-stream" });
}

export async function readProjectBackup(file: Blob) {
  const prefix = new Uint8Array(await file.slice(0, PREFIX_SIZE).arrayBuffer());
  if (prefix.length !== PREFIX_SIZE || !MAGIC.every((value, index) => value === prefix[index])) {
    throw new Error("Este arquivo não é uma cópia de segurança do Stratum 4D.");
  }
  const end = PREFIX_SIZE + new DataView(prefix.buffer).getUint32(MAGIC.length, true);
  if (end > file.size) throw new Error("Arquivo de cópia incompleto.");
  const directory = await file.slice(PREFIX_SIZE, end).arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", directory));
  if (!digest.every((value, index) => value === prefix[HASH_START + index])) {
    throw new Error("A verificação de integridade falhou para o manifesto da cópia.");
  }
  const header = JSON.parse(new TextDecoder().decode(directory)) as { project?: unknown; assets?: AssetEntry[] } | null;
  if (!header?.project || !Array.isArray(header.assets)) throw new Error("O índice de arquivos da cópia é inválido.");
  const project = parseProject(JSON.stringify(header.project));
  const assets = new Map<string, Blob>();
  let offset = end;
  for (const entry of header.assets) {
    if (!entry || typeof entry.hash !== "string" || !HASH.test(entry.hash) || assets.has(entry.hash) ||
      !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > file.size - offset) {
      throw new Error("Arquivo de cópia incompleto ou índice de arquivos inválido.");
    }
    assets.set(entry.hash, file.slice(offset, offset + entry.size));
    offset += entry.size;
  }
  if (offset !== file.size) throw new Error("O tamanho da cópia não corresponde ao índice.");
  const verified = await collectAssets(project, async (hash) => assets.get(hash));
  if (verified.size !== assets.size) throw new Error("A cópia contém arquivos sem referência no projeto.");
  return { project, assets };
}

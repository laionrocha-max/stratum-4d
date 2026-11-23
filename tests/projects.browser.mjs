import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { chromium } from "playwright";
import { createServer, preview } from "vite";

const room = await readFile("tests/fixtures/project-room.ifc", "utf8");
const model = (name, contents = room) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.from(contents) });
const base = model("arquitetura.ifc", room.replace(/ENDSEC;\r?\nEND-ISO-10303-21;/, [
  "#200=IFCSYSTEM('3ST0000000000000000001',#5,'Agua fria',$,$);",
  "#201=IFCRELASSIGNSTOGROUP('3ST0000000000000000002',#5,$,$,(#39),$,#200);",
  "ENDSEC;", "END-ISO-10303-21;",
].join("\n")));
const federation = model("estrutura.ifc", room.replace("'w1'", "'Elemento estrutural'"));
const revision = model("arquitetura-r2.ifc", room.replace("'w1'", "'Parede revisada'").replace(
  "#16=IFCAXIS2PLACEMENT3D(#11,$,$);",
  "#200=IFCCARTESIANPOINT((25.,0.,0.));\n#16=IFCAXIS2PLACEMENT3D(#200,$,$);",
));
const duplicateGuid = model("duplicados.ifc", room.replace("2Ce487x0W8sn4pHI5ncm$z", "1DCsuvJtmnHvlZDV2Ph6gE"));
const changedGuid = "1DCsuvJtmnHvlZDV2Ph6ZZ";
const guidRevision = model("arquitetura-r3.ifc", revision.buffer.toString("utf8").replace("1DCsuvJtmnHvlZDV2Ph6gE", changedGuid));
const xml = await readFile("samples/demo-msproject.xml", "utf8");
const xer = await readFile("samples/demo.xer", "utf8");
const xerRevision = {
  name: "obra-revisada.xer",
  mimeType: "application/octet-stream",
  buffer: Buffer.from(xer.replace(/(?<=\t)1010(?=\t|\r?$)/gm, "9010")
    .replace("SW-100\tExcavation", "SW-100\tExcavation revised")
    .replace("2026-04-20 08:00", "2026-04-27 08:00")),
};
const scheduleRevision = {
  name: "torre-2026-03-11.xml",
  mimeType: "application/xml",
  buffer: Buffer.from(xml
    .replace(/(<Task><UID>|<TaskUID>|<PredecessorUID>)([234])(?=<)/g, (_, prefix, id) => prefix + (100 + Number(id)))
    .replace("2026-03-04T08:00:00</StatusDate>", "2026-03-11T08:00:00</StatusDate>")
    .replace("Columns L1", "Columns L1 revised")
    .replace(/(<Baseline><Number>0<\/Number><Start>)[^<]+/, (_, prefix) => prefix + "2026-01-01T08:00:00")),
};
const options = { host: "127.0.0.1", port: 5191, strictPort: true };
const production = process.env.STRATUM_TEST_BUILD === "1";
const server = production ? await preview({ preview: options }) : await createServer({ server: options });
if (!production) await server.listen();
let browser;

try {
  browser = await chromium.launch({
    executablePath: process.env.STRATUM_BROWSER || undefined,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const context = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1480, height: 950 }, acceptDownloads: true });
    await ctx.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await ctx.addInitScript(() => {
      localStorage.setItem("stratum.config.v1", JSON.stringify({ configured: true, mode: "4d", storage: "local" }));
      const click = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () {
        if (this.type === "file") this.dataset.testPicker = "true";
        else click.call(this);
      };
    });
    return ctx;
  };
  const openPage = async (ctx) => {
    const page = await ctx.newPage();
    page.setDefaultTimeout(12000);
    page.on("pageerror", (error) => console.error("Browser:", error));
    page.on("crash", () => console.error("A página de teste do STRATUM encerrou o processo de renderização."));
    await page.goto("http://127.0.0.1:5191/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator(".viewport canvas").waitFor({ state: "attached", timeout: 60000 });
    return page;
  };
  const visibleStatus = (page, text) => page.locator(".status").getByText(text).waitFor();
  const choose = async (page, button, file) => {
    await button.click();
    await page.locator('[data-test-picker="true"]').setInputFiles(file);
  };
  const menu = async (page, title) => {
    const header = page.locator(`summary[title="${title}"]`);
    if (await header.evaluate((node) => !node.parentElement.open)) await header.click();
    return header.locator("..");
  };
  const fileAction = async (page, name) => (await menu(page, "Arquivo")).getByRole("button", { name, exact: true });
  const add = async (page, file) => {
    const models = await menu(page, "Modelos da obra");
    await choose(page, models.getByRole("button", { name: "Adicionar modelo…" }), file);
    if (await models.evaluate((node) => node.open)) await models.locator("summary").click();
    await visibleStatus(page, new RegExp(`Modelo ${file.name} carregado`));
  };
  const projectDialog = async (page) => {
    const dialog = page.getByRole("dialog", { name: "Projetos" });
    if (!await dialog.isVisible()) await page.getByTitle("Abrir a biblioteca de projetos").click();
    return dialog;
  };
  const newProject = async (page, name) => {
    const dialog = await projectDialog(page);
    const answer = (prompt) => prompt.accept(prompt.type() === "prompt" ? name : undefined);
    page.on("dialog", answer);
    try {
      await dialog.getByRole("button", { name: "Nova obra", exact: true }).click();
      await visibleStatus(page, new RegExp(`Obra ${name} criada`));
    } finally {
      page.off("dialog", answer);
    }
  };
  const selectProject = async (page, name) => {
    const dialog = await projectDialog(page);
    await dialog.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Abrir", exact: true }).click();
    await visibleStatus(page, new RegExp(`Projeto ${name} aberto`));
  };
  const savedManifest = async (page) => {
    const action = await fileAction(page, "Salvar arquivo de projeto");
    const [download] = await Promise.all([page.waitForEvent("download"), action.click()]);
    return JSON.parse(await readFile(await download.path(), "utf8"));
  };
  const save = async (page, name) => {
    await page.getByTitle("Salvar obra na biblioteca (Ctrl+S)").click();
    await visibleStatus(page, new RegExp(`Projeto ${name} salvo`));
  };
  const sameCamera = (actual, expected) => {
    const { orbitOffset: actualRotation, ...actualPose } = actual;
    const { orbitOffset: expectedRotation, ...expectedPose } = expected;
    assert.deepEqual(actualPose, expectedPose);
    assert.equal(actualRotation?.length, expectedRotation?.length);
    actualRotation?.forEach((value, i) => assert.ok(Math.abs(value - expectedRotation[i]) < 1e-12));
  };

  const ctx = await context();
  let page = await openPage(ctx);
  await newProject(page, "Bloco A");
  await add(page, base);
  await choose(page, await fileAction(page, "Importar cronograma (XER / XML)…"), "samples/demo-msproject.xml");
  await visibleStatus(page, /Cronograma Tower .* importado/);
  assert.equal(await page.locator("html").getAttribute("lang"), "pt-BR");
  const properties = page.locator("section").filter({ has: page.getByRole("heading", { name: "Selecionar por propriedade" }) }).last();
  await properties.locator("select").first().selectOption("IfcType");
  const types = await properties.locator("select").nth(1).locator("option").allTextContents();
  const wallType = types.find((type) => type.toUpperCase() === "IFCWALL");
  assert.ok(wallType, `Expected IFC wall type in ${types.join(", ")}`);
  await properties.locator("select").nth(1).selectOption(wallType);
  await properties.getByRole("button", { name: "Selecionar", exact: true }).click();
  await page.locator(".gantt-row:not(.wbs)").first().click();
  await page.getByRole("button", { name: "Vincular", exact: true }).click();
  await visibleStatus(page, /4 elemento\(s\) vinculado/);
  await page.getByTitle(/Pontos de vista salvos/).click();
  page.once("dialog", (message) => message.accept("Vista de conferência"));
  await page.getByRole("button", { name: "Salvar ponto de vista" }).click();
  await visibleStatus(page, /Ponto de vista .* salvo/);
  await page.getByTitle(/Pontos de vista salvos/).click();
  await add(page, federation);
  await page.getByRole("button", { name: "Árvore IFC", exact: true }).click();
  const tree = page.getByRole("region", { name: "Painel da árvore IFC" });
  const rowNamed = (name) => tree.getByRole("treeitem", { name, exact: true });
  const search = tree.getByRole("textbox", { name: "Buscar na árvore IFC" });
  await tree.getByLabel("Sistema IFC", { exact: true }).selectOption("Agua fria");
  await rowNamed("Level 0").waitFor();
  await rowNamed("w1").click();
  await tree.getByText("1 selecionado(s)", { exact: true }).waitFor();
  assert.equal(await rowNamed("w1").getAttribute("aria-selected"), "true");
  await tree.getByLabel("Sistema IFC", { exact: true }).selectOption("");
  await search.fill("1DCsuvJtmnHvlZDV2Ph6gE");
  await rowNamed("Elemento estrutural").click({ modifiers: ["Control"] });
  await tree.getByText("2 selecionado(s)", { exact: true }).waitFor();
  await rowNamed("w1").click();
  await tree.getByRole("button", { name: "Ocultar seleção", exact: true }).click();
  await rowNamed("w1").getByRole("button", { name: "Mostrar w1" }).waitFor();
  await tree.getByRole("button", { name: "Desfazer visibilidade" }).click();
  await rowNamed("w1").getByRole("button", { name: "Ocultar w1" }).waitFor();
  await tree.getByRole("button", { name: "Refazer visibilidade" }).click();
  await rowNamed("w1").getByRole("button", { name: "Mostrar w1" }).waitFor();
  await tree.getByRole("button", { name: "Mostrar todos", exact: true }).click();
  const structureEye = rowNamed("estrutura.ifc").getByRole("button", { name: "Ocultar estrutura.ifc", exact: true });
  assert.ok((await structureEye.locator("svg").boundingBox()).width >= 14);
  await structureEye.click();
  await rowNamed("w1").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Isolar seleção" }).click();
  assert.equal(await tree.getByRole("button", { name: "Isolar", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByTitle("Enquadrar seleção", { exact: true }).click();
  await search.fill("");
  const treeList = tree.getByRole("tree", { name: "Elementos do IFC" });
  await treeList.focus();
  await treeList.press("Escape");
  await tree.getByText("0 selecionado(s)", { exact: true }).waitFor();
  await rowNamed("arquitetura.ifc").getByRole("button", { name: "Recolher arquitetura.ifc", exact: true }).click();
  await page.waitForTimeout(700);
  const canvas = await page.locator(".viewport canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await tree.getByText("1 selecionado(s)", { exact: true }).waitFor();
  assert.equal(await rowNamed("w1").getAttribute("aria-selected"), "true");
  await tree.getByRole("button", { name: "Ghost", exact: true }).click();
  assert.equal(await tree.getByRole("button", { name: "Isolar", exact: true }).getAttribute("aria-pressed"), "false");
  await tree.getByRole("slider", { name: "Opacidade dos elementos Ghost" }).fill("0.4");
  const muted = await savedManifest(page);
  assert.equal(muted.view.settings.visibility.ghostOpacity, 0.4);
  assert.deepEqual(muted.view.settings.visibility.hiddenModels, [muted.models.files[1].id]);
  assert.equal(muted.view.settings.visibility.ghost.length, 1);
  assert.equal(muted.links.length, 4);
  if (process.env.STRATUM_TREE_SCREENSHOT) await page.screenshot({ path: process.env.STRATUM_TREE_SCREENSHOT });
  await tree.getByRole("button", { name: "Mostrar todos", exact: true }).click();
  await rowNamed("estrutura.ifc").getByRole("button", { name: "Mostrar estrutura.ifc", exact: true }).waitFor();
  await tree.getByRole("button", { name: "Reativar modelos", exact: true }).click();
  await rowNamed("arquitetura.ifc").getByRole("button", { name: "Ocultar arquitetura.ifc", exact: true }).click();
  await tree.getByRole("button", { name: "Fechar árvore IFC" }).click();
  console.log("Árvore IFC: pavimento, sistema IFC, GlobalId em dois modelos, Ctrl, menu, ocultar, isolar, Ghost, opacidade e desfazer/refazer.");
  await save(page, "Bloco A");
  const original = await savedManifest(page);
  assert.equal(original.version, 4);
  assert.equal(original.models.files.length, 2);
  assert.equal(original.links.length, 4);
  assert.ok(original.links.every((link) => link.elementId.startsWith(original.models.files[0].id + ":")));
  console.log("A: IFC antes do XML, quatro paredes vinculadas e duas disciplinas com os mesmos GlobalIds.");

  const badMenu = await menu(page, "Modelos da obra");
  await choose(page, badMenu.getByRole("button", { name: "Adicionar modelo…" }), duplicateGuid);
  await visibleStatus(page, /GlobalId\(s\) duplicado/);
  await badMenu.locator("summary").click();
  assert.deepEqual((await savedManifest(page)).models, original.models);

  const row = (await menu(page, "Modelos da obra")).locator(".model-menu-entry").filter({ hasText: "arquitetura.ifc" });
  await choose(page, row.getByRole("button", { name: "Substituir revisão…" }), revision);
  const modelPreview = page.getByRole("dialog", { name: "Prévia da revisão de modelo" });
  await modelPreview.getByText(/Confira a origem compartilhada/).waitFor();
  await modelPreview.getByRole("button", { name: "Cancelar" }).click();
  await visibleStatus(page, /Importação cancelada/);
  assert.deepEqual((await savedManifest(page)).models, original.models);
  await menu(page, "Modelos da obra");
  await choose(page, row.getByRole("button", { name: "Substituir revisão…" }), revision);
  await modelPreview.getByRole("button", { name: "Aplicar revisão" }).click();
  await visibleStatus(page, /Modelo arquitetura-r2.ifc carregado/);
  const revised = await savedManifest(page);
  assert.deepEqual(revised.links, original.links);
  assert.equal(revised.models.files[0].id, original.models.files[0].id);
  assert.equal(revised.models.files[0].revision, 2);
  assert.notEqual(revised.models.files[0].hash, original.models.files[0].hash);
  sameCamera(revised.view.camera, original.view.camera);
  assert.equal(revised.revisions.at(-1).kind, "ifc");
  await save(page, "Bloco A");
  console.log("Revisão: GlobalId duplicado rejeitado, cancelamento preservou estado e atualização manteve os vínculos.");

  await choose(page, await fileAction(page, "Atualizar cronograma…"), scheduleRevision);
  const schedulePreview = page.getByRole("dialog", { name: "Prévia da revisão de cronograma" });
  await schedulePreview.getByText(/4 vínculo\(s\) com correspondência automática/).waitFor();
  await schedulePreview.getByRole("button", { name: "Aplicar revisão" }).click();
  await visibleStatus(page, /Revisão de cronograma aplicada/);
  const updated = await savedManifest(page);
  assert.equal(updated.links.length, 4);
  assert.ok(updated.links.every((link) => Number(link.activityId) > 100));
  assert.ok(updated.schedule.activities.some((a) => a.name === "Columns L1 revised"));
  assert.equal(updated.schedule.activities[0].baselineStart, original.schedule.activities[0].baselineStart);
  sameCamera(updated.view.camera, revised.view.camera);
  assert.deepEqual(updated.presentation, original.presentation);
  assert.notEqual(updated.schedule.dataDate, revised.schedule.dataDate);
  await save(page, "Bloco A");
  console.log("Cronograma: nova data de corte, UID renumerado, baseline original e câmera mantidas.");

  const backupAction = await fileAction(page, "Gerar cópia de segurança…");
  const [backupDownload] = await Promise.all([page.waitForEvent("download"), backupAction.click()]);
  const backup = { name: backupDownload.suggestedFilename(), mimeType: "application/octet-stream", buffer: await readFile(await backupDownload.path()) };
  const cold = await context();
  const restoredPage = await openPage(cold);
  const manifestOnly = { name: "manifesto.stratum.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(updated)) };
  await choose(restoredPage, await fileAction(restoredPage, "Abrir arquivo de projeto…"), manifestOnly);
  await visibleStatus(restoredPage, /0 modelo\(s\) e 4 vínculo\(s\).*Localizar arquivo/);
  await (await fileAction(restoredPage, "Histórico de revisões…")).click();
  const coldHistory = restoredPage.getByRole("dialog", { name: "Histórico de revisões" });
  restoredPage.once("dialog", (prompt) => prompt.accept());
  await coldHistory.getByRole("button", { name: "Restaurar estado anterior" }).first().click();
  await visibleStatus(restoredPage, /restauração não foi aplicada.*indisponível/);
  await choose(restoredPage, await fileAction(restoredPage, "Restaurar cópia de segurança…"), {
    ...backup, buffer: backup.buffer.subarray(0, backup.buffer.length - 1),
  });
  await visibleStatus(restoredPage, /A cópia não foi restaurada.*incompleto/i);
  assert.deepEqual((await savedManifest(restoredPage)).links, updated.links);
  await restoredPage.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    let writes = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === "stratum-model-files" && ++writes === 2) {
        IDBObjectStore.prototype.put = put;
        throw new DOMException("Limite de armazenamento simulado", "QuotaExceededError");
      }
      return put.apply(this, args);
    };
  });
  await choose(restoredPage, await fileAction(restoredPage, "Restaurar cópia de segurança…"), backup);
  await visibleStatus(restoredPage, /A cópia não foi restaurada.*Limite de armazenamento simulado/);
  const partialAssets = await restoredPage.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("stratum-model-files");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const count = await new Promise((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return count;
  });
  assert.equal(partialAssets, 0);
  assert.deepEqual((await savedManifest(restoredPage)).links, updated.links);
  await choose(restoredPage, await fileAction(restoredPage, "Restaurar cópia de segurança…"), backup);
  await visibleStatus(restoredPage, /Cópia restaurada na biblioteca/);
  await selectProject(restoredPage, "Bloco A — cópia restaurada");
  await visibleStatus(restoredPage, /2 modelo\(s\) e 4 vínculo\(s\)/);
  const coldRestored = await savedManifest(restoredPage);
  assert.notEqual(coldRestored.projectKey, updated.projectKey);
  assert.deepEqual(coldRestored.models, updated.models);
  assert.deepEqual(coldRestored.links, updated.links);
  assert.deepEqual(coldRestored.schedule, updated.schedule);
  assert.deepEqual(coldRestored.presentation, updated.presentation);
  assert.deepEqual(coldRestored.revisions, updated.revisions);
  sameCamera(coldRestored.view.camera, updated.view.camera);
  await (await fileAction(restoredPage, "Histórico de revisões…")).click();
  restoredPage.once("dialog", (prompt) => prompt.accept());
  await coldHistory.getByRole("button", { name: "Restaurar estado anterior" }).first().click();
  await visibleStatus(restoredPage, /2 modelo\(s\) e 4 vínculo\(s\)/);
  const coldPrevious = await savedManifest(restoredPage);
  assert.deepEqual(coldPrevious.links, revised.links);
  assert.equal(coldPrevious.schedule.dataDate, revised.schedule.dataDate);
  assert.equal(coldPrevious.revisions.at(-1).kind, "restore");
  const earlierIfc = updated.revisions.find((entry) => entry.kind === "ifc");
  await (await fileAction(restoredPage, "Histórico de revisões…")).click();
  const previousIfc = coldHistory.locator("section").filter({ has: restoredPage.getByRole("heading", { name: `Revisão de modelo · ${earlierIfc.source.name}`, exact: true }) });
  restoredPage.once("dialog", (prompt) => prompt.accept());
  await previousIfc.getByRole("button", { name: "Restaurar estado anterior" }).click();
  await visibleStatus(restoredPage, /2 modelo\(s\) e 4 vínculo\(s\)/);
  const restoredIfc = await savedManifest(restoredPage);
  assert.deepEqual(restoredIfc.models, original.models);
  await cold.close();
  console.log("Perfil vazio: manifesto simples pediu arquivos; backup truncado foi rejeitado; cópia completa recuperou dois IFCs, cronograma, vínculos, vistas e os estados anteriores.");

  await newProject(page, "Bloco B");
  await choose(page, await fileAction(page, "Importar cronograma (XER / XML)…"), "samples/demo.xer");
  await visibleStatus(page, /Cronograma .* importado/);
  await add(page, model("topografia.ifc", room.replace("'w1'", "'Referência topográfica'")));
  await save(page, "Bloco B");
  const second = await savedManifest(page);
  assert.notEqual(second.projectKey, revised.projectKey);
  assert.deepEqual(second.view.settings.visibility.hiddenModels, []);
  assert.equal(second.links.length, 0);
  assert.notEqual(second.schedule.projectCode, revised.schedule.projectCode);

  await page.close();
  page = await openPage(ctx);
  await page.getByRole("dialog", { name: "Projetos" }).waitFor();
  await selectProject(page, "Bloco A");
  await visibleStatus(page, /2 modelo\(s\) e 4 vínculo\(s\)/);
  const reopened = await savedManifest(page);
  assert.deepEqual(reopened.models, updated.models);
  assert.deepEqual(reopened.links, updated.links);
  sameCamera(reopened.view.camera, revised.view.camera);
  assert.deepEqual(reopened.view.settings.visibility, updated.view.settings.visibility);
  assert.deepEqual(reopened.view.settings.visibility.hiddenModels, [reopened.models.files[0].id]);
  await (await fileAction(page, "Histórico de revisões…")).click();
  const revisions = page.getByRole("dialog", { name: "Histórico de revisões" });
  await revisions.getByText("Revisão de cronograma · torre-2026-03-11.xml").waitFor();
  page.once("dialog", (message) => message.accept());
  await revisions.getByRole("button", { name: "Restaurar estado anterior" }).first().click();
  await visibleStatus(page, /Projeto Bloco A aberto/);
  const rolledBack = await savedManifest(page);
  assert.deepEqual(rolledBack.links, revised.links);
  assert.deepEqual(rolledBack.models, revised.models);
  assert.equal(rolledBack.schedule.dataDate, revised.schedule.dataDate);
  assert.equal(rolledBack.revisions.at(-1).kind, "restore");
  console.log("Histórico: reabertura e rollback restauraram os vínculos, cronograma e IFCs anteriores.");
  const revisedModel = (await menu(page, "Modelos da obra")).locator(".model-menu-entry").filter({ hasText: "arquitetura-r2.ifc" });
  await choose(page, revisedModel.getByRole("button", { name: "Substituir revisão…" }), guidRevision);
  const manualPreview = page.getByRole("dialog", { name: "Prévia da revisão de modelo" });
  await manualPreview.waitFor();
  const manual = manualPreview.getByRole("textbox");
  assert.equal(await manual.count(), 1);
  await manual.fill("identificador-incorreto");
  await manualPreview.getByRole("button", { name: "Aplicar revisão" }).click();
  await manualPreview.getByRole("alert").getByText(/Destino inválido/).waitFor();
  await manual.fill(changedGuid);
  await manualPreview.getByRole("button", { name: "Aplicar revisão" }).click();
  await visibleStatus(page, /Modelo arquitetura-r3.ifc carregado/);
  const remapped = await savedManifest(page);
  assert.equal(remapped.links.length, rolledBack.links.length);
  assert.ok(remapped.links.some((link) => link.elementId.endsWith(changedGuid)));
  assert.ok(remapped.links.every((link) => !link.elementId.endsWith("1DCsuvJtmnHvlZDV2Ph6gE")));
  assert.deepEqual(remapped.presentation, original.presentation);
  console.log("IFC: GlobalId alterado exigiu destino válido e preservou o vínculo após remapeamento explícito.");
  await selectProject(page, "Bloco B");
  const reopenedSecond = await savedManifest(page);
  assert.deepEqual(reopenedSecond.models, second.models);
  assert.equal(reopenedSecond.links.length, 0);
  console.log("Reabertura: duas obras recuperaram somente seus próprios modelos, cronograma, vínculos e câmera.");

  await page.getByRole("button", { name: "Seleção", exact: true }).click();
  const topographyProperties = page.locator("section").filter({ has: page.getByRole("heading", { name: "Selecionar por propriedade" }) }).last();
  await topographyProperties.locator("select").first().selectOption("IfcType");
  await topographyProperties.locator("select").nth(1).selectOption(wallType);
  await topographyProperties.getByRole("button", { name: "Selecionar", exact: true }).click();
  await page.locator(".gantt-row:not(.wbs)").filter({ hasText: "SW-100" }).click();
  await page.getByRole("button", { name: "Vincular", exact: true }).click();
  await visibleStatus(page, /4 elemento\(s\) vinculado/);
  await choose(page, await fileAction(page, "Atualizar cronograma…"), xerRevision);
  const xerPreview = page.getByRole("dialog", { name: "Prévia da revisão de cronograma" });
  await xerPreview.getByText(/4 vínculo\(s\) com correspondência automática/).waitFor();
  await xerPreview.getByRole("button", { name: "Aplicar revisão" }).click();
  await visibleStatus(page, /Revisão de cronograma aplicada/);
  const xerUpdated = await savedManifest(page);
  assert.equal(xerUpdated.links.length, 4);
  assert.ok(xerUpdated.links.every((link) => link.activityId === "9010"));
  assert.equal(xerUpdated.schedule.activities.find((activity) => activity.code === "SW-100").name, "Excavation revised");
  assert.ok(xerUpdated.schedule.dataDate > second.schedule.dataDate);
  await save(page, "Bloco B");
  console.log("XER: revisão preservou quatro vínculos pelo código da atividade após mudança do ID interno e da data de corte.");

  const dialog = await projectDialog(page);
  const secondRow = dialog.getByRole("row", { name: /Bloco B/ });
  await secondRow.locator("summary").click();
  page.once("dialog", (prompt) => prompt.accept("Cópia de B"));
  await secondRow.getByRole("button", { name: "Duplicar" }).click();
  const copy = dialog.getByRole("row", { name: /Cópia de B/ });
  await copy.waitFor();
  await copy.locator("summary").click();
  page.once("dialog", (prompt) => prompt.accept("Cópia renomeada"));
  await copy.getByRole("button", { name: "Renomear", exact: true }).click();
  const renamed = dialog.getByRole("row", { name: /Cópia renomeada/ });
  await renamed.waitFor();
  if (await renamed.locator("summary").evaluate((node) => !node.parentElement.open)) await renamed.locator("summary").click();
  await renamed.getByRole("button", { name: "Arquivar", exact: true }).click();
  await renamed.waitFor({ state: "detached" });
  await dialog.getByLabel("Mostrar arquivadas").check();
  await renamed.waitFor();
  await renamed.locator("summary").click();
  page.once("dialog", (prompt) => prompt.accept());
  await renamed.getByRole("button", { name: "Excluir", exact: true }).click();
  await renamed.waitFor({ state: "detached" });
  assert.ok(await secondRow.isVisible());
  console.log("Biblioteca: duplicar, renomear, arquivar e excluir a cópia preservou a obra original.");

  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Exibição", exact: true }).click();
  await page.getByLabel("Modo apresentação").check();
  await page.getByLabel("Céu natural").check();
  await page.getByLabel("Modo apresentação").uncheck();
  await page.getByTitle(/Editor de animação com quadros-chave/).click();
  const editor = page.locator('[aria-label="Editor de animação"]');
  await editor.getByRole("button", { name: "Novo", exact: true }).click();
  await editor.getByLabel("Duração").fill("2");
  const exportAnimation = async (format) => {
    await editor.getByRole("button", { name: "Exportar…" }).click();
    const output = page.getByRole("dialog", { name: "Exportar animação" });
    await output.getByLabel("Saída").selectOption(format);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90000 }),
      output.getByRole("button", { name: "Exportar", exact: true }).click(),
    ]);
    return readFile(await download.path());
  };
  const pngs = unzipSync(await exportAnimation("images"));
  const frameNames = Object.keys(pngs).filter((name) => name.endsWith(".png")).sort();
  assert.equal(frameNames.length, 31);
  const firstFrame = Buffer.from(pngs[frameNames[0]]);
  assert.equal(firstFrame.readUInt32BE(16), 1280);
  assert.equal(firstFrame.readUInt32BE(20), 720);
  assert.ok(!firstFrame.equals(Buffer.from(pngs[frameNames.at(-1)])));
  assert.equal((await exportAnimation("video")).subarray(0, 4).toString("hex"), "1a45dfa3");
  console.log("Português, aparência leve e apresentação, sequência de 31 PNGs HD e exportação WebM.");

  const clean = await context();
  const other = await openPage(clean);
  const { models, ...legacy } = original;
  legacy.version = 2;
  legacy.links = legacy.links.map((l) => ({ ...l, elementId: l.elementId.split(":").at(-1) }));
  const legacyFile = { name: "legado.stratum.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(legacy)) };
  await choose(other, await fileAction(other, "Abrir arquivo de projeto…"), legacyFile);
  await visibleStatus(other, /Localizar arquivo para: arquitetura.ifc/);
  const modelMenu = await menu(other, "Modelos da obra");
  other.once("dialog", (prompt) => prompt.accept());
  await choose(other, modelMenu.getByRole("button", { name: "Localizar arquivo…" }), base);
  await visibleStatus(other, /1 de 1 modelo\(s\)/);
  const migrated = await savedManifest(other);
  assert.deepEqual(migrated.links, legacy.links);
  assert.equal(migrated.models.files[0].id, "");
  assert.equal(migrated.version, 4);
  console.log("Migração: JSON v2 localizou o IFC e conservou os vínculos legados.");

  if (process.env.STRATUM_BIG_IFC) {
    other.setDefaultTimeout(45000);
    await newProject(other, "Ensaio de escala");
    const start = performance.now();
    await add(other, model("escala.ifc", await readFile(process.env.STRATUM_BIG_IFC)));
    const loadSeconds = ((performance.now() - start) / 1000).toFixed(1);
    await other.getByRole("button", { name: "Árvore IFC", exact: true }).click();
    const largeTree = other.getByRole("tree", { name: "Elementos do IFC" });
    const startFilter = performance.now();
    await other.getByRole("textbox", { name: "Buscar na árvore IFC" }).fill("IFCWALL");
    const metrics = await largeTree.evaluate((list) => ({
      rows: list.querySelectorAll('[role="treeitem"]').length,
      treeHeight: list.scrollHeight,
      viewportHeight: list.clientHeight,
    }));
    assert.ok(metrics.treeHeight >= 4000 * 30, JSON.stringify(metrics));
    assert.ok(metrics.rows < 45, JSON.stringify(metrics));
    await largeTree.focus();
    await largeTree.press("End");
    const end = await largeTree.evaluate((list) => list.scrollTop + list.clientHeight);
    assert.ok(end >= metrics.treeHeight - 2);
    await largeTree.press("Enter");
    await other.getByText("1 selecionado(s)", { exact: true }).waitFor();
    const filterMs = Math.round(performance.now() - startFilter);
    console.log(`Escala: IFC com 4.000 paredes importado em ${loadSeconds}s, ${metrics.rows} linhas montadas, busca e seleção pelo teclado em ${filterMs}ms.`);
  }
} finally {
  await browser?.close();
  if (production) await new Promise((resolve) => server.httpServer.close(resolve));
  else await server.close();
}

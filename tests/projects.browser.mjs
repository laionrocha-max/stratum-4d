import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { chromium } from "playwright";
import { createServer, preview } from "vite";

const room = await readFile("tests/fixtures/project-room.ifc", "utf8");
const model = (name, contents = room) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.from(contents) });
const base = model("arquitetura.ifc");
const federation = model("estrutura.ifc", room.replace("'w1'", "'Elemento estrutural'"));
const revision = model("arquitetura-r2.ifc", room.replace("'w1'", "'Parede revisada'").replace(
  "#16=IFCAXIS2PLACEMENT3D(#11,$,$);",
  "#200=IFCCARTESIANPOINT((25.,0.,0.));\n#16=IFCAXIS2PLACEMENT3D(#200,$,$);",
));
const duplicateGuid = model("duplicados.ifc", room.replace("2Ce487x0W8sn4pHI5ncm$z", "1DCsuvJtmnHvlZDV2Ph6gE"));
const changedGuid = "1DCsuvJtmnHvlZDV2Ph6ZZ";
const guidRevision = model("arquitetura-r3.ifc", revision.buffer.toString("utf8").replace("1DCsuvJtmnHvlZDV2Ph6gE", changedGuid));
const xml = await readFile("samples/demo-msproject.xml", "utf8");
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
  assert.deepEqual(revised.view.camera, original.view.camera);
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
  assert.deepEqual(updated.view.camera, revised.view.camera);
  assert.deepEqual(updated.presentation, original.presentation);
  assert.notEqual(updated.schedule.dataDate, revised.schedule.dataDate);
  await save(page, "Bloco A");
  console.log("Cronograma: nova data de corte, UID renumerado, baseline original e câmera mantidas.");

  await newProject(page, "Bloco B");
  await choose(page, await fileAction(page, "Importar cronograma (XER / XML)…"), "samples/demo.xer");
  await visibleStatus(page, /Cronograma .* importado/);
  await add(page, model("topografia.ifc", room.replace("'w1'", "'Referência topográfica'")));
  await save(page, "Bloco B");
  const second = await savedManifest(page);
  assert.notEqual(second.projectKey, revised.projectKey);
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
  assert.deepEqual(reopened.view.camera, revised.view.camera);
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

  const dialog = await projectDialog(page);
  const secondRow = dialog.getByRole("row", { name: /Bloco B/ });
  await secondRow.locator("summary").click();
  page.once("dialog", (prompt) => prompt.accept("Cópia de B"));
  await secondRow.getByRole("button", { name: "Duplicar" }).click();
  const copy = dialog.getByRole("row", { name: /Cópia de B/ });
  await copy.waitFor();
  await copy.locator("summary").click();
  await copy.getByRole("button", { name: "Arquivar", exact: true }).click();
  await copy.waitFor({ state: "detached" });
  await dialog.getByLabel("Mostrar arquivadas").check();
  await copy.waitFor();
  await copy.locator("summary").click();
  page.once("dialog", (prompt) => prompt.accept());
  await copy.getByRole("button", { name: "Excluir", exact: true }).click();
  await copy.waitFor({ state: "detached" });
  assert.ok(await secondRow.isVisible());
  console.log("Biblioteca: duplicar, arquivar e excluir a cópia preservou a obra original.");

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
} finally {
  await browser?.close();
  if (production) await new Promise((resolve) => server.httpServer.close(resolve));
  else await server.close();
}

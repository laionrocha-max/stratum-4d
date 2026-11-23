import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";

const options = { host: "127.0.0.1", port: 5193, strictPort: true };
const server = process.env.STRATUM_TEST_BUILD === "1" ? await preview({ preview: options }) : null;
const url = server ? `http://${options.host}:${options.port}/` : process.env.STRATUM_TEST_URL ?? "http://127.0.0.1:5180/";
const shell = new URL("/__test_project_shell__", url).href;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.STRATUM_BROWSER || undefined,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem("stratum.config.v1", JSON.stringify({ configured: true, mode: "4d", storage: "local" }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/prompt|allow-(modals|forms)|form submission/i.test(message.text())) console.log(message.text());
  });
  const staleEntry = process.env.STRATUM_STALE_ENTRY;
  if (staleEntry) {
    assert.match(staleEntry, /^\.\/assets\/index-[\w-]+\.js$/);
    const previous = await page.request.get(new URL(staleEntry, url).href);
    assert.ok(previous.ok(), "O arquivo da compilação anterior precisa estar disponível.");
    const response = await page.request.get(url);
    const html = await response.text();
    const current = html.match(/src="(\.\/assets\/index-[\w-]+\.js)"/)?.[1];
    assert.ok(current && current !== staleEntry, "A compilação atual precisa ser diferente da anterior.");
    await page.route(url, (route) => route.fulfill({
      response,
      body: html.replace(current, staleEntry),
    }));
  }
  await page.route(shell, (route) => route.fulfill({
    contentType: "text/html",
    body: `<iframe title="Stratum em painel incorporado" src=${JSON.stringify(url)} width="1350" height="850" sandbox="allow-scripts allow-same-origin"></iframe>`,
  }));
  await page.goto(shell, { waitUntil: "domcontentloaded", timeout: 45000 });
  const app = page.frameLocator("iframe");
  const library = app.getByRole("dialog", { name: "Projetos" });
  await app.locator(".viewport canvas").waitFor({ state: "attached", timeout: 45000 });
  const openLibrary = async () => {
    if (!await library.isVisible()) await app.getByTitle("Abrir a biblioteca de projetos").click();
  };
  const openLibraryFromFile = async () => {
    const file = app.locator('summary[title="Arquivo"]');
    if (!await file.evaluate((item) => item.parentElement.open)) await file.click();
    await app.getByRole("button", { name: "Abrir da biblioteca…", exact: true }).click();
  };
  const newButton = library.getByRole("button", { name: "Nova obra", exact: true });
  const start = async () => {
    await openLibrary();
    await newButton.click();
  };
  const name = library.getByRole("textbox", { name: "Nome da nova obra" });
  const create = library.getByRole("button", { name: "Criar obra", exact: true });
  if (staleEntry) {
    for (const title of ["Teste antigo", "Segunda obra antiga"]) {
      await start();
      await name.fill(title);
      await create.click();
      await app.locator(".status").getByText(`Obra ${title} criada. Importe os modelos e o cronograma em qualquer ordem.`).waitFor();
    }
    await openLibraryFromFile();
    await library.getByText("Crie uma obra ou salve na biblioteca a obra que está aberta.").waitFor();
    assert.equal(await library.getByRole("textbox", { name: "Buscar obras" }).inputValue(), "");
    assert.equal(await library.getByRole("button", { name: "Salvar como nova", exact: true }).count(), 0);
    assert.equal(await app.locator(".project-active").innerText(), "Segunda obra antiga");
    await library.getByRole("button", { name: "Salvar obra atual", exact: true }).click();
    const recovered = library.getByRole("row", { name: /Segunda obra antiga/ });
    await recovered.waitFor();
    await page.unroute(url);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    await recovered.waitFor({ timeout: 45000 });
    assert.equal(await library.getByRole("row", { name: /Teste antigo/ }).count(), 0);
    console.log("A versão anterior reproduziu duas criações com Biblioteca vazia. Salvar obra atual registrou a segunda, que reapareceu após recarregar na versão nova.");
  }
  await start();
  await name.waitFor();
  assert.equal(await name.evaluate((input) => input === input.ownerDocument.activeElement), true);
  await name.press("Escape");
  await name.waitFor({ state: "hidden" });
  assert.equal(await newButton.evaluate((button) => button === button.ownerDocument.activeElement), true);
  await start();
  await name.fill("   ");
  assert.equal(await create.isEnabled(), false);
  await name.fill("  Teste  ");
  await name.press("Enter");
  await app.locator(".status").getByText(/Obra Teste criada/).waitFor();
  await openLibrary();
  const first = library.getByRole("row", { name: /\bTeste\b/ });
  await first.waitFor();
  await start();
  await library.getByText(/A obra atual será fechada/).waitFor();
  await name.fill("Cancelar esta obra");
  await library.getByRole("button", { name: "Cancelar", exact: true }).click();
  await name.waitFor({ state: "hidden" });
  await first.waitFor();
  assert.equal(await app.locator(".project-active").innerText(), "Teste");
  assert.equal(await library.getByRole("row", { name: /Cancelar esta obra/ }).count(), 0);
  await start();
  await name.fill("Criação com falha");
  await library.evaluate((dialog) => {
    const db = dialog.ownerDocument.defaultView.indexedDB;
    const open = db.open;
    db.open = function (database, ...args) {
      if (database === "stratum-local") {
        db.open = open;
        throw new DOMException("Armazenamento indisponível no teste", "QuotaExceededError");
      }
      return open.call(this, database, ...args);
    };
  });
  await create.click();
  await library.getByRole("alert").filter({ hasText: /Não foi possível criar a obra/ }).waitFor();
  assert.equal(await app.locator(".project-active").innerText(), "Teste");
  assert.equal(await library.getByRole("row", { name: /Criação com falha/ }).count(), 0);
  await name.fill("Segunda obra");
  await create.click();
  await app.locator(".status").getByText(/Obra Segunda obra criada/).waitFor();
  await openLibraryFromFile();
  const second = library.getByRole("row", { name: /Segunda obra(?! antiga)/ });
  await first.waitFor();
  await second.waitFor();
  const search = library.getByRole("textbox", { name: "Buscar obras" });
  await search.fill("Teste");
  await first.waitFor();
  await second.waitFor({ state: "hidden" });
  await search.fill("Segunda obra");
  await second.waitFor();
  await first.waitFor({ state: "hidden" });
  const extraTitles = Array.from({ length: 8 }, (_, i) => `Obra vazia ${i + 3}`);
  for (const title of extraTitles) {
    await start();
    await name.fill(title);
    await create.click();
    await app.locator(".status").getByText(`Obra ${title} criada e salva na biblioteca.`, { exact: false }).waitFor();
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
  await library.waitFor({ timeout: 45000 });
  for (const title of ["Teste", "Segunda obra", ...extraTitles]) {
    await library.getByRole("cell", { name: title, exact: true }).waitFor();
  }
  assert.equal(await library.getByRole("row", { name: /Criação com falha/ }).count(), 0);
  await first.getByRole("button", { name: "Abrir", exact: true }).click();
  await app.locator(".status").getByText(/Projeto Teste aberto\. 0 modelo\(s\) e 0 vínculo\(s\)/).waitFor();
  console.log("Dez obras vazias apareceram na biblioteca após recarregar, antes de clicar em Salvar. A primeira abriu com zero modelos e vínculos.");
  await app.getByTitle("Salvar obra na biblioteca (Ctrl+S)").click();
  await app.locator(".status").getByText(/Projeto Teste salvo \(versão 2\)/).waitFor();
  await openLibrary();
  await first.waitFor();
  assert.equal(await first.count(), 1);
  assert.deepEqual(errors, []);
  console.log("Criei Teste e Segunda obra, encontrei ambas via Arquivo → Abrir da biblioteca, pesquisei cada nome e reabri após recarregar.");
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
}

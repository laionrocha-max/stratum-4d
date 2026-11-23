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
  const newButton = library.getByRole("button", { name: "Nova obra", exact: true });
  const start = async () => {
    await openLibrary();
    await newButton.click();
  };
  const name = library.getByRole("textbox", { name: "Nome da nova obra" });
  const create = library.getByRole("button", { name: "Criar obra", exact: true });
  await start();
  await name.waitFor();
  assert.equal(await name.evaluate((input) => input === input.ownerDocument.activeElement), true);
  await name.press("Escape");
  await name.waitFor({ state: "hidden" });
  assert.equal(await newButton.evaluate((button) => button === button.ownerDocument.activeElement), true);
  await start();
  await name.fill("   ");
  assert.equal(await create.isEnabled(), false);
  await name.fill("  Obra do painel  ");
  await name.press("Enter");
  await app.locator(".status").getByText(/Obra Obra do painel criada/).waitFor();
  await openLibrary();
  const first = library.getByRole("row", { name: /Obra do painel/ });
  await first.waitFor();
  await start();
  await library.getByText(/A obra atual será fechada/).waitFor();
  await name.fill("Cancelar esta obra");
  await library.getByRole("button", { name: "Cancelar", exact: true }).click();
  await name.waitFor({ state: "hidden" });
  await library.getByRole("row", { name: /Obra do painel/ }).waitFor();
  assert.equal(await app.locator(".project-active").innerText(), "Obra do painel");
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
  assert.equal(await app.locator(".project-active").innerText(), "Obra do painel");
  assert.equal(await library.getByRole("row", { name: /Criação com falha/ }).count(), 0);
  await name.fill("Segunda obra");
  await create.click();
  await app.locator(".status").getByText(/Obra Segunda obra criada/).waitFor();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
  await library.waitFor({ timeout: 45000 });
  await library.getByRole("row", { name: /Segunda obra/ }).waitFor();
  assert.equal(await library.getByRole("row", { name: /Criação com falha/ }).count(), 0);
  await library.getByRole("row", { name: /Obra do painel/ }).getByRole("button", { name: "Abrir", exact: true }).click();
  await app.locator(".status").getByText(/Projeto Obra do painel aberto/).waitFor();
  await app.getByTitle("Salvar obra na biblioteca (Ctrl+S)").click();
  await app.locator(".status").getByText(/Projeto Obra do painel salvo \(versão 2\)/).waitFor();
  await openLibrary();
  await first.waitFor();
  assert.equal(await first.count(), 1);
  assert.deepEqual(errors, []);
  console.log("Nova obra aparece na biblioteca ao criar e reabre após atualizar a página. Falha de gravação preserva a obra ativa. Salvar mantém a mesma entrada.");
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
}

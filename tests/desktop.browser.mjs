import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron } from "playwright";

const folder = await mkdtemp(join(tmpdir(), "stratum-desktop-test-"));
const profile = join(folder, "profile");
const launcher = join(folder, "launch.cjs");
const { version } = JSON.parse(await readFile("node_modules/electron/package.json", "utf8"));
await writeFile(launcher, [
  'const { app } = require("electron");',
  `app.setPath("userData", ${JSON.stringify(profile)});`,
  `require(${JSON.stringify(resolve("electron/main.cjs"))});`,
].join("\n"));
const launch = () => _electron.launch({
  args: [launcher, "--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  timeout: 45000,
});

let application;
try {
  application = await launch();
  let page = await application.firstWindow();
  page.setDefaultTimeout(20000);
  await page.waitForLoadState("domcontentloaded");
  assert.ok(page.url().startsWith("app://stratum/"));
  await page.evaluate(() => {
    localStorage.setItem("stratum.config.v1", JSON.stringify({ configured: true, mode: "4d", storage: "local" }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".viewport canvas").waitFor({ state: "attached" });
  assert.equal(await page.evaluate(() => typeof window.stratumDesktop?.invoke), "function");
  await page.getByRole("button", { name: /Subestação GIS de 220 kV/ }).click();
  await page.locator(".status").getByText(/elementos vinculados a .* atividades/).waitFor();
  await page.getByTitle("Salvar obra na biblioteca (Ctrl+S)").click();
  await page.locator(".status").getByText(/Projeto .* salvo/).waitFor();
  await application.close();
  application = await launch();
  page = await application.firstWindow();
  page.setDefaultTimeout(20000);
  const library = page.getByRole("dialog", { name: "Projetos" });
  await library.waitFor();
  await library.getByRole("button", { name: "Abrir", exact: true }).first().click();
  await page.locator(".status").getByText(/Projeto .* aberto com o modelo de exemplo/).waitFor();
  console.log(`Electron ${version}: carregamento, ponte nativa, gravação e reabertura após reiniciar em perfil temporário.`);
} finally {
  await application?.close();
}

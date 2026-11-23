import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const options = { host: "127.0.0.1", port: 5192, strictPort: true };
const server = await createServer({ server: options });
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.STRATUM_BROWSER || undefined,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  await page.route("**/navigation-fixture", (route) => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html><body style="margin:0"><div id="viewport" style="width:900px;height:650px"></div></body></html>',
  }));
  await page.goto("http://127.0.0.1:5192/navigation-fixture");
  const initialized = await page.evaluate(async () => {
    const [{ Viewer }, { Box3, BoxGeometry, Mesh, MeshLambertMaterial, Vector3 }] = await Promise.all([
      import("/src/viewer/Viewer.ts"),
      import("/node_modules/three/build/three.module.js"),
    ]);
    const origin = new Vector3(2_500_000, 15, -5_000_000);
    const viewer = new Viewer(document.getElementById("viewport"));
    const wall = (x) => {
      const mesh = new Mesh(new BoxGeometry(4, 3, 2), new MeshLambertMaterial({ color: "#6dace0" }));
      mesh.position.copy(origin).add(new Vector3(x, 0, 0));
      return mesh;
    };
    const a = wall(-5);
    const b = wall(7);
    const hidden = wall(250);
    viewer.setObjects(new Map([["a", a], ["b", b], ["hidden", hidden]]), [], false);
    viewer.applyStates(new Map([["hidden", { visible: false, color: null, transparency: 0 }]]));
    const initial = { pos: origin.clone().add(new Vector3(20, 13, 25)).toArray(), target: origin.clone().add(new Vector3(126, 0, 0)).toArray(), fov: 45 };
    viewer.setCamera(initial);
    const initialRotation = viewer.camera.quaternion.clone();
    const initialPosition = viewer.camera.position.clone();
    viewer.setSelection(new Set(["a"]));
    const single = {
      distance: viewer.controls.target.distanceTo(a.position),
      drift: viewer.camera.position.distanceTo(initialPosition),
      rotation: viewer.camera.quaternion.angleTo(initialRotation),
    };
    viewer.setSelection(new Set(["a", "b"]));
    const multi = viewer.controls.target.distanceTo(a.position.clone().add(b.position).multiplyScalar(0.5));
    viewer.setSelection(new Set());
    const clear = viewer.controls.target.distanceTo(new Box3().setFromObject(a).union(new Box3().setFromObject(b)).union(new Box3().setFromObject(hidden)).getCenter(new Vector3()));
    viewer.setCamera({ ...initial, target: origin.toArray() });
    viewer.setSelection(new Set(["a"]));
    window.testNavigation = { viewer, origin, a, b, hidden, Box3, Vector3 };
    return { single, multi, clear };
  });
  assert.ok(initialized.single.distance < 1e-5);
  assert.ok(initialized.single.drift < 1e-5);
  assert.ok(initialized.single.rotation < 1e-5);
  assert.ok(initialized.multi < 1e-5);
  assert.ok(initialized.clear < 1e-5);
  const visibleFit = await page.evaluate(() => {
    const { viewer, origin, Vector3 } = window.testNavigation;
    const saved = viewer.getCamera();
    viewer.fit();
    const error = viewer.controls.target.distanceTo(origin.clone().add(new Vector3(1, 0, 0)));
    viewer.setCamera(saved);
    return error;
  });
  assert.ok(visibleFit < 1e-5);

  const camera = () => page.evaluate(() => {
    const { viewer } = window.testNavigation;
    return { ...viewer.getCamera(), radius: viewer.controls.getDistance() };
  });
  const before = await camera();
  await page.mouse.move(420, 310);
  await page.mouse.down();
  await page.mouse.move(520, 350, { steps: 10 });
  await page.mouse.up();
  const after = await camera();
  assert.ok(Math.hypot(...after.pos.map((v, i) => v - before.pos[i])) > 1);
  assert.ok(Math.abs(after.radius - before.radius) < 0.001);
  assert.deepEqual(after.target, before.target);
  await page.evaluate(() => window.testNavigation.viewer.viewFrom("top"));
  await page.mouse.down();
  assert.equal(await page.evaluate(() => window.testNavigation.viewer.flying), false);
  await page.mouse.up();
  await page.waitForTimeout(750);
  const beforePan = await camera();
  await page.mouse.down({ button: "right" });
  await page.mouse.move(560, 370, { steps: 8 });
  await page.mouse.up({ button: "right" });
  assert.ok(Math.hypot(...(await camera()).pos.map((v, i) => v - beforePan.pos[i])) > 0.1);
  await page.waitForTimeout(750);
  const beforeZoom = await page.evaluate(() => {
    const { viewer, a } = window.testNavigation;
    return viewer.camera.position.distanceTo(a.position);
  });
  await page.mouse.wheel(0, -150);
  assert.ok((await camera()).radius < beforeZoom);
  console.log("Gestos reais: órbita no elemento, deslocamento lateral, zoom e limpeza sem mudança de pose ao selecionar.");

  const movement = await page.evaluate(() => {
    const { viewer, a, origin, Box3, Vector3 } = window.testNavigation;
    viewer.setExplode(0.35, "radial");
    viewer.applyFrame(new Map(), new Map([["a", { offset: [3, 0, 2], yaw: Math.PI / 3 }]]));
    viewer.setSelection(new Set());
    viewer.setSelection(new Set(["a"]));
    const worldBox = new Box3().setFromObject(a);
    const moved = viewer.controls.target.distanceTo(worldBox.getCenter(new Vector3()));
    const x = worldBox.getCenter(new Vector3()).x;
    viewer.setSections([{ id: "cut", axis: "x", pos: 0.5, on: true, flip: false }], null, {
      min: [x - 20, origin.y - 20, origin.z - 20], max: [x + 20, origin.y + 20, origin.z + 20],
    });
    viewer.setSelection(new Set());
    viewer.setSelection(new Set(["a"]));
    const expected = worldBox.clone();
    expected.max.x = x;
    const section = viewer.controls.target.distanceTo(expected.getCenter(new Vector3()));
    const saved = viewer.getCamera();
    const first = viewer.renderFrame(400, 230).toDataURL();
    viewer.viewFrom("top");
    viewer.setCamera(saved);
    const second = viewer.renderFrame(400, 230).toDataURL();
    const exported = viewer.renderFrame(400, 230);
    return { moved, section, sameImage: first === second, width: exported.width, height: exported.height };
  });
  assert.ok(movement.moved < 1e-5);
  assert.ok(movement.section < 1e-5);
  assert.equal(movement.sameImage, true);
  assert.equal(movement.width, 400);
  assert.equal(movement.height, 230);
  console.log("Bounds em coordenadas distantes, peça em movimento, explosão, corte e exportação da vista restaurada.");
} finally {
  await browser?.close();
  await server.close();
}

import { Box3, PerspectiveCamera, Plane, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { cameraAt } from "../src/core/presentation";
import { localizeDefaultProfiles, DEFAULT_PROFILES } from "../src/core/profiles";
import { clipNavigationBounds, PivotOrbitControls } from "../src/viewer/navigation";

describe("a câmera mantém o enquadramento ao trocar o pivô", () => {
  it("preserva posição e orientação em trocas repetidas de pivô com coordenadas distantes", () => {
    const camera = new PerspectiveCamera(45, 1.6, 0.1, 5000);
    const origin = new Vector3(6_000_000, 20, -9_000_000);
    camera.position.copy(origin).add(new Vector3(12, 15, 17));
    const controls = new PivotOrbitControls(camera, null);
    controls.target.copy(origin);
    controls.update();
    const position = camera.position.clone();
    const orientation = camera.quaternion.clone();
    for (const offset of [[15, 5, 12], [-1, 14, 7], [0, 0, 0]]) {
      const pivot = origin.clone().add(new Vector3(...offset));
      controls.setPivot(pivot);
      for (let i = 0; i < 10; i++) controls.update();
      expect(controls.target.distanceTo(pivot)).toBeLessThan(0.00001);
      expect(camera.position.distanceTo(position)).toBeLessThan(0.00001);
      expect(camera.quaternion.angleTo(orientation)).toBeLessThan(0.00001);
    }
  });

  it("limita o enquadramento aos trechos visíveis de uma seção", () => {
    const box = new Box3(new Vector3(10, 0, 0), new Vector3(30, 8, 4));
    clipNavigationBounds(box, [
      new Plane(new Vector3(1, 0, 0), -18),
      new Plane(new Vector3(-1, 0, 0), 22),
    ]);
    expect(box.getCenter(new Vector3()).toArray()).toEqual([20, 4, 2]);
    expect(box.getSize(new Vector3()).toArray()).toEqual([4, 8, 4]);
    clipNavigationBounds(box, [new Plane(new Vector3(0, 1, 0), -20)]);
    expect(box.isEmpty()).toBe(true);
  });

  it("interpola vistas novas e antigas sem descartar a rotação gravada", () => {
    const offset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI * 0.6);
    const base = { pos: [3, 2, 1] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 45 };
    const from = { t: 0, interp: "linear" as const, camera: { ...base, orbitOffset: offset.toArray() } };
    const to = { t: 2, interp: "linear" as const, camera: base };
    expect(cameraAt([from, to], 0)?.orbitOffset).toEqual(offset.toArray());
    expect(new Quaternion().fromArray(cameraAt([from, to], 1)!.orbitOffset!).angleTo(new Quaternion())).toBeCloseTo(Math.PI * 0.3);
    expect(cameraAt([to], 2)?.orbitOffset).toBeUndefined();
  });

  it("traduz rótulos padrão de projetos antigos sem renomear perfis personalizados", () => {
    const install = DEFAULT_PROFILES[0];
    const example = [{ ...install, name: "Install" }, { ...install, id: "private", name: "Install" }];
    expect(localizeDefaultProfiles(example).map((profile) => profile.name)).toEqual(["Instalação", "Install"]);
  });
});

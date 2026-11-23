// three.js viewport: one Object3D per model element (or segment), 4D states
// applied each frame, picking, selection highlight, equipment motion,
// clipping for growth and segments, path drawing, camera fit, capture.
//
// Speed: elements are only repainted when their state actually changes, so
// playback on a large model touches the few elements whose task is moving,
// not the whole model every frame.

import * as THREE from "three";
import { clipNavigationBounds, outsideClip, PivotOrbitControls } from "./navigation";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { DemoBox } from "../core/demo";
import { regionEmpty, regionKey, regionWithGrowth, segmentRegion, type Motion, type Region } from "../core/motion";
import type { ElementState } from "../core/simulation";
import { solarPosition, type SolarSettings } from "../core/solar";
import type { CameraState, CutBox, CutPlane, Vec3 } from "../core/presentation";
import type { ElementSegment, MotionPath } from "../core/types";

interface Entry {
  object: THREE.Object3D;
  originals: Map<THREE.Mesh, THREE.Material>;
  /** Per-mesh override materials (cloned from the originals on first use). */
  overrides: Map<THREE.Mesh, THREE.MeshLambertMaterial> | null;
  /** World-space box at the modelled position. */
  box: THREE.Box3;
  basePos: THREE.Vector3;
  baseYaw: number;
  segment: Region | null;
  key: string;
}

const SELECT_COLOR = new THREE.Color("#ff7a00");
/** Teardown: the accent for the work under way, and the ghost colour for everything else. */
const FOCUS_COLOR = "#e10600";
const GHOST_COLOR = "#9aa5b1";

export type ExplodeMode = "storeys" | "radial";
export interface CutState {
  axis: "x" | "y" | "z";
  /** 0..1 across the model. */
  pos: number;
  /** Keep the other side. */
  flip: boolean;
}
const DEFAULT_STATE: ElementState = { visible: true, color: null, transparency: 0 };
const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: PivotOrbitControls;
  private root = new THREE.Group();
  private overlay = new THREE.Group();
  private entries = new Map<string, Entry>();
  private selected = new Set<string>();
  private states = new Map<string, ElementState>();
  private motions = new Map<string, Motion>();
  private raycaster = new THREE.Raycaster();
  private needsRender = true;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  /** Elements repainted by the last frame (for diagnostics/tests). */
  lastRepaintCount = 0;
  // Teardown state: exploded view, cutaway and focus on the work under way.
  private explodeAmount = 0;
  private explodeMode: ExplodeMode = "storeys";
  /** Element id → storey (or group) index, bottom first. */
  private explodeGroups = new Map<string, number>();
  private modelBox = new THREE.Box3();
  private readonly skyLight = new THREE.HemisphereLight("#ffffff", "#8d8778", 1.6);
  private readonly sunLight = new THREE.DirectionalLight("#ffffff", 1.4);
  private readonly presentationMaterials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private sky: Sky | null = null;
  private naturalSky = false;
  private sunDirection = new THREE.Vector3(-0.8, 1.15, 0.55).normalize();
  private sunElevation = 50;
  private presentationLook = false;
  private darkTheme = false;
  private cut: CutState | null = null;
  /** Section planes and the section box from the Sections panel (kept with the teardown cut). */
  private sections: { planes: CutPlane[]; box: CutBox | null } = { planes: [], box: null };
  private boxHelper: THREE.Box3Helper | null = null;
  private focus: Set<string> | null = null;
  /** Whether focused elements take the accent colour (otherwise they keep their 4D colours). */
  private focusRecolor = true;
  private flight: {
    from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3];
    t0: number; ms: number; fov: [number, number]; offsets: [THREE.Quaternion, THREE.Quaternion];
  } | null = null;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color("#eef1f5");
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.set(30, 25, 35);
    this.controls = new PivotOrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.addEventListener("change", () => (this.needsRender = true));
    this.controls.addEventListener("start", () => {
      this.flight = null;
      this.syncOrbitPivot();
    });

    this.sunLight.position.set(40, 80, 30);
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.00015;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.skyLight, this.sunLight, this.sunLight.target);
    const grid = new THREE.GridHelper(400, 80, "#c3c9d2", "#d9dee5");
    grid.position.y = -2.5;
    this.scene.add(grid);
    this.grid = grid;
    this.scene.add(this.root);
    this.scene.add(this.overlay);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    const loop = () => {
      if (this.disposed) return;
      if (this.flight) {
        const f = this.flight;
        const u = Math.min(1, (performance.now() - f.t0) / f.ms);
        // State to state: ease in and out.
        const k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        this.camera.position.lerpVectors(f.from[0], f.to[0], k);
        this.controls.target.lerpVectors(f.from[1], f.to[1], k);
        this.controls.viewOffset.slerpQuaternions(f.offsets[0], f.offsets[1], k);
        this.camera.fov = f.fov[0] + (f.fov[1] - f.fov[0]) * k;
        this.camera.updateProjectionMatrix();
        this.needsRender = true;
        if (u >= 1) this.flight = null;
      }
      this.controls.update();
      if (this.needsRender) {
        this.sky?.position.copy(this.camera.position);
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  /** Move the canvas into another container (interface layouts place the 3D view differently). */
  private grid: THREE.GridHelper | null = null;

  /** Match the viewport to the light or dark interface. */
  setTheme(theme: "light" | "dark") {
    const dark = theme === "dark";
    this.darkTheme = dark;
    this.updateBackground();
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      const g = new THREE.GridHelper(400, 80, dark ? "#3a424d" : "#c3c9d2", dark ? "#2a3038" : "#d9dee5");
      g.position.copy(this.grid.position);
      g.visible = this.grid.visible;
      this.scene.add(g);
      this.grid = g;
    }
    this.requestRender();
  }

  private updateBackground() {
    const natural = this.presentationLook && this.naturalSky;
    const daylight = natural && this.sunElevation > -6;
    if (daylight && !this.sky) {
      this.sky = new Sky();
      this.sky.scale.setScalar(10000);
      this.sky.frustumCulled = false;
      this.scene.add(this.sky);
    }
    if (this.sky) {
      this.sky.visible = daylight;
      this.sky.material.uniforms.sunPosition.value.copy(this.sunDirection);
    }
    const presentationBackground = natural && !daylight ? "#121c32" : "#c5d3dd";
    this.scene.background = new THREE.Color(this.presentationLook ? presentationBackground : this.darkTheme ? "#1b1f25" : "#eef1f5");
  }

  setSolarLighting(naturalSky: boolean, settings?: SolarSettings) {
    this.naturalSky = naturalSky;
    const solar = settings ? solarPosition(settings) : null;
    if (solar) {
      const azimuth = THREE.MathUtils.degToRad(solar.azimuth + (Number.isFinite(settings!.north) ? settings!.north : 0));
      const elevation = THREE.MathUtils.degToRad(solar.elevation);
      this.sunDirection.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation));
      this.sunElevation = solar.elevation;
    } else {
      this.sunDirection.set(-0.8, 1.15, 0.55).normalize();
      this.sunElevation = 50;
    }
    if (this.presentationLook) {
      this.updatePresentationLights();
      this.updateBackground();
      this.requestRender();
    }
  }

  private updatePresentationLights() {
    const daylight = Math.max(0, Math.sin(THREE.MathUtils.degToRad(this.sunElevation)));
    this.sunLight.castShadow = this.sunElevation > 0;
    this.sunLight.intensity = this.sunElevation > 0 ? 2.85 * Math.sqrt(daylight) : 0;
    this.sunLight.color.set("#ffb46e").lerp(new THREE.Color("#fff0db"), Math.min(1, daylight * 2.8));
    this.skyLight.intensity = this.sunElevation > 0 ? 0.95 + 0.5 * daylight : 0.38;
    this.frameShadows();
  }

  setPresentationLook(on: boolean) {
    if (this.presentationLook === on) return;
    this.presentationLook = on;
    this.renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = on;
    this.sunLight.castShadow = on;
    this.sunLight.color.set(on ? "#fff0db" : "#ffffff");
    this.sunLight.intensity = on ? 2.6 : 1.4;
    this.skyLight.color.set(on ? "#e5efff" : "#ffffff");
    this.skyLight.groundColor.set(on ? "#9b8e78" : "#8d8778");
    this.skyLight.intensity = on ? 1.45 : 1.6;
    if (on) this.updatePresentationLights();
    else {
      this.sunLight.position.set(40, 80, 30);
      this.sunLight.target.position.set(0, 0, 0);
    }
    this.updateBackground();
    for (const id of this.entries.keys()) this.paint(id, true);
    this.requestRender();
  }

  private frameShadows() {
    if (this.modelBox.isEmpty()) return;
    const center = this.modelBox.getCenter(new THREE.Vector3());
    const radius = Math.max(this.modelBox.getSize(new THREE.Vector3()).length() * 0.55, 1);
    this.sunLight.target.position.copy(center);
    this.sunLight.position.copy(center).addScaledVector(this.sunDirection, radius * 2);
    const camera = this.sunLight.shadow.camera;
    camera.left = camera.bottom = -radius;
    camera.right = camera.top = radius;
    camera.near = radius * 0.1;
    camera.far = radius * 4;
    camera.updateProjectionMatrix();
    this.sunLight.shadow.normalBias = radius / 2048;
  }

  private presentationMaterial(source: THREE.Material): THREE.Material {
    if (!(source instanceof THREE.MeshLambertMaterial)) return source;
    const cached = this.presentationMaterials.get(source);
    if (cached) return cached;
    const color = source.color.clone();
    if (!source.map) {
      const hsl = color.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
      color.setHSL(hsl.h, hsl.s * 0.58, hsl.l, THREE.SRGBColorSpace);
    }
    const material = new THREE.MeshStandardMaterial({
      color, map: source.map, alphaMap: source.alphaMap, opacity: source.opacity,
      transparent: source.transparent, alphaTest: source.alphaTest, side: source.side,
      depthWrite: source.depthWrite, vertexColors: source.vertexColors,
      roughness: 0.84, metalness: 0,
    });
    this.presentationMaterials.set(source, material);
    return material;
  }

  attach(container: HTMLElement) {
    if (container === this.container) return;
    this.resizeObserver.disconnect();
    this.container = container;
    container.appendChild(this.renderer.domElement);
    this.resizeObserver.observe(container);
    this.resize();
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clear();
    this.sunLight.shadow.dispose();
    this.sky?.geometry.dispose();
    this.sky?.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  clear() {
    this.flight = null;
    for (const entry of this.entries.values()) {
      for (const [mesh, material] of entry.originals) {
        mesh.material = material;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
      for (const material of entry.overrides?.values() ?? []) material.dispose();
    }
    for (const material of this.presentationMaterials.values()) material.dispose();
    this.presentationMaterials.clear();
    this.root.clear();
    this.entries.clear();
    this.selected.clear();
    this.states.clear();
    this.motions.clear();
    this.modelBox.makeEmpty();
    this.focus = null;
    this.needsRender = true;
  }

  get elementCount() {
    return this.entries.size;
  }

  private register(id: string, object: THREE.Object3D, segment: Region | null) {
    object.userData.elementId = id;
    const originals = new Map<THREE.Mesh, THREE.Material>();
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        originals.set(m, m.material as THREE.Material);
        m.userData.elementId = id;
      }
    });
    this.root.add(object);
    object.updateMatrixWorld(true);
    object.traverse((o) => (o.matrixAutoUpdate = false));
    this.entries.set(id, {
      object,
      originals,
      overrides: null,
      box: new THREE.Box3().setFromObject(object),
      basePos: object.position.clone(),
      baseYaw: object.rotation.y,
      segment,
      key: "",
    });
  }

  /** Load element objects. Split elements are replaced by clipped clones, one per segment. */
  setObjects(objects: Map<string, THREE.Object3D>, segments: ElementSegment[] = [], fit = true) {
    this.clear();
    const byParent = new Map<string, ElementSegment[]>();
    for (const s of segments) (byParent.get(s.parentId) ?? byParent.set(s.parentId, []).get(s.parentId)!).push(s);
    for (const [id, object] of objects) {
      const segs = byParent.get(id);
      if (!segs) {
        this.register(id, object, null);
        continue;
      }
      for (const s of segs) this.register(s.id, object.clone(), segmentRegion(s));
    }
    this.modelBox = new THREE.Box3();
    for (const e of this.entries.values()) this.modelBox.union(e.box);
    if (this.presentationLook) this.frameShadows();
    for (const id of this.entries.keys()) this.paint(id, true);
    this.applyCut();
    if (fit) this.fit();
  }

  // ---------------------------------------------------------------- teardown

  /** Pull the model apart: storeys stack apart vertically, or every element moves out from the centre. */
  setExplode(amount: number, mode: ExplodeMode, groups?: Map<string, number>) {
    this.explodeAmount = Math.max(0, Math.min(1, amount));
    this.explodeMode = mode;
    if (groups) this.explodeGroups = groups;
    for (const id of this.entries.keys()) this.paint(id, true);
    this.needsRender = true;
  }

  private explodeOffset(id: string, e: Entry): [number, number, number] {
    if (this.explodeAmount <= 0 || this.modelBox.isEmpty()) return [0, 0, 0];
    const size = this.modelBox.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, size.y);
    const a = this.explodeAmount;
    if (this.explodeMode === "storeys") {
      // Each storey rises by its index; the gap is a share of the model, so small and large models both read.
      const g = this.explodeGroups.get(id) ?? this.explodeGroups.get(id.split("#")[0]) ?? 0;
      return [0, g * a * Math.max(size.y * 0.9, span * 0.18), 0];
    }
    const c = this.modelBox.getCenter(new THREE.Vector3());
    const m = e.box.getCenter(new THREE.Vector3());
    const d = new THREE.Vector3(m.x - c.x, 0, m.z - c.z);
    const len = d.length();
    if (len < 1e-6) return [0, a * span * 0.25, 0];
    d.multiplyScalar(a * 0.9);
    return [d.x, a * (m.y - this.modelBox.min.y) * 0.6, d.z];
  }

  /** Cut the model with a section plane across one axis (null removes it). */
  setCut(cut: CutState | null) {
    this.cut = cut;
    this.applyCut();
    this.needsRender = true;
  }

  /** Section planes and a section box (fractions of the model's extent). Everything outside all of them is cut away. */
  setSections(planes: CutPlane[], box: CutBox | null, bounds?: { min: Vec3; max: Vec3 }) {
    this.sections = { planes, box };
    this.sectionBounds = bounds && [bounds.min, bounds.max].every((vec) =>
      Array.isArray(vec) && vec.length === 3 && vec.every(Number.isFinite)) ? bounds : undefined;
    this.applyCut();
    this.needsRender = true;
  }

  private sectionBounds?: { min: Vec3; max: Vec3 };

  getSectionBounds(): { min: Vec3; max: Vec3 } | undefined {
    return this.sectionBounds ?? (this.modelBox.isEmpty() ? undefined : { min: this.modelBox.min.toArray(), max: this.modelBox.max.toArray() });
  }

  /** World coordinate of a fraction across the model on one axis. */
  private at(axis: "x" | "y" | "z", pos: number, bounds?: { min: Vec3; max: Vec3 }) {
    const i = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const min = bounds?.min[i] ?? this.modelBox.min[axis];
    const max = bounds?.max[i] ?? this.modelBox.max[axis];
    return min + (max - min) * Math.max(0, Math.min(1, pos));
  }

  /** The plane that keeps the near side of `at` (or the far side with flip). */
  private keep(axis: "x" | "y" | "z", at: number, flip: boolean) {
    const n = AXIS[axis].clone();
    return flip ? new THREE.Plane(n, -at) : new THREE.Plane(n.negate(), at);
  }

  private applyCut() {
    if (this.boxHelper) {
      this.overlay.remove(this.boxHelper);
      this.boxHelper = null;
    }
    if (this.modelBox.isEmpty()) {
      this.renderer.clippingPlanes = [];
      return;
    }
    // Renderer planes clip what is outside any of them, so the kept part is the intersection.
    // Room for an exploded model: cuts are placed on the modelled positions.
    const planes: THREE.Plane[] = [];
    if (this.cut) planes.push(this.keep(this.cut.axis, this.at(this.cut.axis, this.cut.pos), this.cut.flip));
    for (const c of this.sections.planes) if (c.on) planes.push(this.keep(c.axis, this.at(c.axis, c.pos, this.sectionBounds), c.flip));
    const b = this.sections.box;
    if (b?.on) {
      const axes = ["x", "y", "z"] as const;
      const lo = new THREE.Vector3();
      const hi = new THREE.Vector3();
      axes.forEach((a, i) => {
        const p = this.at(a, Math.min(b.min[i], b.max[i]), this.sectionBounds);
        const q = this.at(a, Math.max(b.min[i], b.max[i]), this.sectionBounds);
        lo[a] = p;
        hi[a] = q;
        planes.push(this.keep(a, p, true), this.keep(a, q, false));
      });
      this.boxHelper = new THREE.Box3Helper(new THREE.Box3(lo, hi), new THREE.Color("#e10600"));
      this.overlay.add(this.boxHelper);
    }
    this.renderer.clippingPlanes = planes;
  }

  /** Extent of some elements as fractions (0..1) of the model on each axis, for a section box around them. */
  fractionsOf(ids: Iterable<string>): { min: [number, number, number]; max: [number, number, number] } | null {
    const box = new THREE.Box3();
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) box.union(e.box);
    }
    const bounds = this.getSectionBounds();
    if (box.isEmpty() || !bounds) return null;
    const f = (v: number, a: "x" | "y" | "z") => {
      const i = a === "x" ? 0 : a === "y" ? 1 : 2;
      const span = bounds.max[i] - bounds.min[i];
      return span > 0 ? Math.max(0, Math.min(1, (v - bounds.min[i]) / span)) : 0;
    };
    // A small margin, so faces on the box do not flicker.
    const pad = 0.01;
    return {
      min: [Math.max(0, f(box.min.x, "x") - pad), Math.max(0, f(box.min.y, "y") - pad), Math.max(0, f(box.min.z, "z") - pad)],
      max: [Math.min(1, f(box.max.x, "x") + pad), Math.min(1, f(box.max.y, "y") + pad), Math.min(1, f(box.max.z, "z") + pad)],
    };
  }

  /** The camera as plain numbers, for viewpoints and animation keys. */
  getCamera(): CameraState {
    const p = this.camera.position;
    const t = this.controls.target;
    const { up, near, far, fov, aspect } = this.camera;
    const offset = this.controls.viewOffset;
    return {
      pos: p.toArray(), target: t.toArray(), fov, up: up.toArray(), aspect,
      viewport: [this.renderer.domElement.width, this.renderer.domElement.height],
      clipping: [near, far], projection: "perspective",
      ...(Math.abs(offset.w) < 1 - 1e-12 ? { orbitOffset: offset.toArray() } : {}),
    };
  }

  /** Put the camera at a stored state, at once (ms = 0) or in a short flight. */
  setCamera(c: CameraState, ms = 0) {
    this.controls.stopInertia();
    const pos = new THREE.Vector3(...c.pos);
    const target = new THREE.Vector3(...c.target);
    const offset = new THREE.Quaternion();
    if (c.orbitOffset?.length === 4 && c.orbitOffset.every(Number.isFinite)) offset.fromArray(c.orbitOffset).normalize();
    if (c.up && c.up.length === 3 && c.up.every(Number.isFinite) && c.up.some((value) => value !== 0)) this.camera.up.set(...c.up);
    const clipping = c.clipping;
    if (clipping?.length === 2 && clipping.every(Number.isFinite) && clipping[0] > 0 && clipping[1] > clipping[0]) {
      [this.camera.near, this.camera.far] = clipping;
      this.camera.updateProjectionMatrix();
    }
    if (ms > 0) {
      this.flight = {
        from: [this.camera.position.clone(), this.controls.target.clone()], to: [pos, target],
        t0: performance.now(), ms, fov: [this.camera.fov, c.fov], offsets: [this.controls.viewOffset.clone(), offset],
      };
    } else {
      this.flight = null;
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.viewOffset.copy(offset);
      this.camera.fov = c.fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    }
    this.needsRender = true;
  }

  /** Look at the whole model from a standard direction (Y is up; the front looks along -Z). */
  viewFrom(dir: "top" | "front" | "back" | "left" | "right" | "iso") {
    const d = {
      top: new THREE.Vector3(0, 1, 0.0001),
      front: new THREE.Vector3(0, 0.0001, 1),
      back: new THREE.Vector3(0, 0.0001, -1),
      left: new THREE.Vector3(-1, 0.0001, 0),
      right: new THREE.Vector3(1, 0.0001, 0),
      iso: new THREE.Vector3(1, 0.75, 1.15),
    }[dir].normalize();
    this.frameBox(this.navBounds(), d, 700);
  }

  /** Frame the whole model from the current direction. */
  zoomAll() {
    this.fit(undefined, 600);
  }

  private frameDistance(diagonal: number, multiplier: number) {
    const verticalHalfFov = THREE.MathUtils.degToRad(this.camera.getEffectiveFOV()) / 2;
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * this.camera.aspect);
    // Fit the model's bounding sphere in both directions, including narrow panes.
    const distance = diagonal / (2 * Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)));
    return Math.max(diagonal * multiplier, distance * 1.08);
  }

  /**
   * Render one frame at a fixed size (for video and image export), then put the
   * viewport back. The camera keeps its field of view; only the aspect changes.
   */
  renderFrame(width: number, height: number): HTMLCanvasElement {
    const canvas = this.renderer.domElement;
    const ratio = this.renderer.getPixelRatio();
    this.flight = null;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.sky?.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    out.getContext("2d")!.drawImage(canvas, 0, 0);
    this.renderer.setPixelRatio(ratio);
    this.resize();
    return out;
  }

  /** Show or hide the ground grid (hidden in exported videos if wanted). */
  setGridVisible(on: boolean) {
    if (this.grid) this.grid.visible = on;
    this.needsRender = true;
  }

  /** Show the elements of the work under way in the accent and ghost the rest (null: everything as usual). */
  setFocus(ids: Set<string> | null, opts: { recolor?: boolean } = {}) {
    const before = this.focus;
    this.focus = ids && ids.size ? ids : null;
    const recolor = opts.recolor ?? true;
    if (before === this.focus && recolor === this.focusRecolor) return;
    this.focusRecolor = recolor;
    for (const id of this.entries.keys()) this.paint(id, true);
    this.needsRender = true;
  }

  /** World box of some elements, at their current (exploded) positions. */
  boxOf(ids?: Iterable<string>): THREE.Box3 {
    const box = new THREE.Box3();
    const list = ids ? [...ids] : [...this.entries.keys()];
    for (const id of list) {
      const e = this.entries.get(id);
      if (!e) continue;
      const o = this.explodeOffset(id, e);
      box.union(e.box.clone().translate(new THREE.Vector3(o[0], o[1], o[2])));
    }
    return box;
  }

  private navBounds(ids?: Iterable<string>) {
    const box = new THREE.Box3();
    const extent = new THREE.Box3();
    for (const id of ids ?? this.entries.keys()) {
      const entry = this.entries.get(id);
      if (!entry?.object.visible) continue;
      extent.setFromObject(entry.object);
      const motion = entry.object.position.clone().sub(entry.basePos);
      if (entry.segment) {
        for (const axis of ["x", "y", "z"] as const) {
          const span = entry.segment[axis];
          if (!span) continue;
          const min = entry.box.min[axis] + motion[axis];
          const size = entry.box.max[axis] - entry.box.min[axis];
          extent.min[axis] = Math.max(extent.min[axis], min + span[0] * size);
          extent.max[axis] = Math.min(extent.max[axis], min + span[1] * size);
        }
      }
      clipNavigationBounds(extent, this.renderer.clippingPlanes);
      if (!extent.isEmpty()) box.union(extent);
    }
    return box;
  }

  private syncOrbitPivot() {
    const selection = this.selected.size ? this.navBounds(this.selected) : null;
    const box = selection && !selection.isEmpty() ? selection : this.modelBox;
    if (!box.isEmpty()) this.controls.setPivot(box.getCenter(new THREE.Vector3()));
  }

  /** Fly the camera to frame some elements (or the whole model), keeping the current viewing direction roughly. */
  flyTo(ids: Iterable<string> | null, ms = 1600, dir?: THREE.Vector3, distance = 1.5) {
    const box = this.boxOf(ids ?? undefined);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const whole = this.boxOf().getSize(new THREE.Vector3()).length();
    // Small parts are framed with some of their surroundings, so the viewer keeps their bearings.
    const size = Math.max(box.getSize(new THREE.Vector3()).length(), whole * 0.22);
    const d = (dir ?? this.camera.position.clone().sub(this.controls.target)).normalize();
    if (d.y < 0.25) d.y = 0.35;
    d.normalize();
    const to = center.clone().addScaledVector(d, size * distance);
    this.setCamera({ pos: to.toArray(), target: center.toArray(), fov: this.camera.fov }, ms);
  }

  /** Turn the camera around its target (radians), for the auto tour. */
  orbit(rad: number) {
    if (this.flight) return;
    const t = this.controls.target;
    const p = this.camera.position.clone().sub(t);
    p.applyAxisAngle(AXIS.y, rad);
    this.camera.position.copy(t).add(p);
    this.needsRender = true;
  }

  get flying() {
    return this.flight !== null;
  }

  static demoObjects(boxes: DemoBox[]): Map<string, THREE.Object3D> {
    const objects = new Map<string, THREE.Object3D>();
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const mats = new Map<string, THREE.MeshLambertMaterial>();
    for (const b of boxes) {
      let mat = mats.get(b.color);
      if (!mat) {
        mat = new THREE.MeshLambertMaterial({ color: b.color, side: THREE.DoubleSide });
        mats.set(b.color, mat);
      }
      const mesh = new THREE.Mesh(unit, mat);
      mesh.position.set(...b.center);
      mesh.scale.set(...b.size);
      objects.set(b.element.id, mesh);
    }
    return objects;
  }

  fit(ids?: Iterable<string>, ms = 0) {
    const box = this.navBounds(ids);
    const direction = ms > 0 ? this.camera.getWorldDirection(new THREE.Vector3()).negate() : new THREE.Vector3(1, 0.75, 1.15).normalize();
    this.frameBox(!ids && box.isEmpty() ? this.modelBox : box, direction, ms);
  }

  private frameBox(box: THREE.Box3, direction: THREE.Vector3, ms: number) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(0.001, box.getSize(new THREE.Vector3()).length());
    const distance = this.frameDistance(size, 1.45);
    const position = center.clone().addScaledVector(direction, distance);
    const whole = this.modelBox.getSize(new THREE.Vector3()).length();
    const far = Math.max(size * 20, distance + whole * 2);
    this.setCamera({ pos: position.toArray(), target: center.toArray(), fov: this.camera.fov, clipping: [Math.max(0.0001, size / 1000), far] }, ms);
  }

  /** Apply one frame of 4D state and motion. Only changed elements are repainted. */
  applyFrame(states: Map<string, ElementState>, motions: Map<string, Motion> = new Map()) {
    this.states = states;
    this.motions = motions;
    let n = 0;
    for (const id of this.entries.keys()) if (this.paint(id)) n++;
    this.lastRepaintCount = n;
    if (n) this.needsRender = true;
  }

  /** Kept for callers that only have states. */
  applyStates(states: Map<string, ElementState>) {
    this.applyFrame(states, this.motions);
  }

  setSelection(ids: Set<string>) {
    if (ids.size === this.selected.size && [...ids].every((id) => this.selected.has(id))) return;
    this.flight = null;
    const changed = new Set([...this.selected, ...ids]);
    this.selected = new Set(ids);
    for (const id of changed) this.paint(id);
    this.syncOrbitPivot();
    this.needsRender = true;
  }

  /** Returns true when the element was repainted. */
  private paint(id: string, force = false): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    const s0 = this.states.get(id) ?? DEFAULT_STATE;
    // Focus: work under way in the accent, the rest ghosted (hidden elements stay hidden).
    const ghost = this.focus !== null && !this.focus.has(id);
    const s: ElementState = !this.focus ? s0 : ghost ? { ...s0, color: GHOST_COLOR, transparency: Math.max(s0.transparency, 0.84) } : this.focusRecolor ? { ...s0, color: FOCUS_COLOR, transparency: 0 } : s0;
    const motion = this.motions.get(id);
    const ex = this.explodeOffset(id, entry);
    const isSel = this.selected.has(id);
    const clip = regionWithGrowth(entry.segment, s.clip ?? null);
    const r = (x: number) => Math.round(x * 1000) / 1000;
    const key = [
      s.visible ? 1 : 0,
      s.color ?? "",
      r(s.transparency),
      isSel ? 1 : 0,
      regionKey(clip),
      motion ? `${r(motion.offset[0])},${r(motion.offset[1])},${r(motion.offset[2])},${r(motion.yaw)}` : "",
      ex[0] || ex[1] || ex[2] ? `${r(ex[0])},${r(ex[1])},${r(ex[2])}` : "",
    ].join("|");
    if (!force && key === entry.key) return false;
    entry.key = key;

    // Position (equipment on a path).
    const obj = entry.object;
    const mo = motion?.offset ?? [0, 0, 0];
    const off: [number, number, number] = [mo[0] + ex[0], mo[1] + ex[1], mo[2] + ex[2]];
    obj.position.set(entry.basePos.x + off[0], entry.basePos.y + off[1], entry.basePos.z + off[2]);
    obj.rotation.y = entry.baseYaw + (motion?.yaw ?? 0);
    obj.updateMatrix();
    obj.updateMatrixWorld(true);

    const clipEmpty = regionEmpty(clip);
    obj.visible = (s.visible && !clipEmpty) || isSel;

    const needOverride = isSel || s.color !== null || s.transparency > 0 || clip !== null;
    if (!needOverride) {
      for (const [mesh, mat] of entry.originals) {
        mesh.material = this.presentationLook ? this.presentationMaterial(mat) : mat;
        mesh.castShadow = this.presentationLook && !mat.transparent;
        mesh.receiveShadow = this.presentationLook;
      }
      return true;
    }
    if (!entry.overrides) {
      entry.overrides = new Map();
      for (const [mesh, mat] of entry.originals) {
        const src = mat as THREE.MeshLambertMaterial;
        entry.overrides.set(mesh, new THREE.MeshLambertMaterial({ color: src.color?.clone() ?? new THREE.Color("#cccccc"), side: THREE.DoubleSide }));
      }
    }
    let planes: THREE.Plane[] | null = null;
    if (clip && !isSel) {
      const box = entry.box.clone().translate(new THREE.Vector3(off[0], off[1], off[2]));
      planes = [];
      for (const ax of ["x", "y", "z"] as const) {
        const range = clip[ax];
        if (!range) continue;
        const min = box.min[ax];
        const size = box.max[ax] - min;
        const a = min + range[0] * size;
        const b = min + range[1] * size;
        planes.push(new THREE.Plane(AXIS[ax].clone(), -a), new THREE.Plane(AXIS[ax].clone().negate(), b));
      }
    }
    const opacity = isSel ? 1 : 1 - s.transparency;
    for (const [mesh, m] of entry.overrides) {
      const orig = entry.originals.get(mesh) as THREE.MeshLambertMaterial;
      if (isSel) m.color.copy(SELECT_COLOR);
      else if (s.color) m.color.set(s.color);
      else m.color.copy(orig.color ?? new THREE.Color("#cccccc"));
      m.transparent = opacity < 1;
      m.opacity = opacity;
      m.depthWrite = opacity > 0.5;
      m.clippingPlanes = planes;
      m.needsUpdate = true;
      mesh.material = m;
      mesh.castShadow = false;
      mesh.receiveShadow = this.presentationLook;
    }
    return true;
  }

  /** Element id under a client-space point, ignoring hidden and ghosted elements. */
  pick(clientX: number, clientY: number): string | null {
    const hit = this.hit(clientX, clientY);
    return hit?.id ?? null;
  }

  /** World point under the cursor: on a visible element, else on the ground plane (y = 0). */
  pickPoint(clientX: number, clientY: number): [number, number, number] | null {
    const hit = this.hit(clientX, clientY);
    if (hit) return [hit.point.x, hit.point.y, hit.point.z];
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? [p.x, p.y, p.z] : null;
  }

  private hit(clientX: number, clientY: number): { id: string; point: THREE.Vector3 } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.root.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      let visible = true;
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) visible = false;
      if (!visible) continue;
      while (o && !o.userData.elementId) o = o.parent;
      const id = o?.userData.elementId as string | undefined;
      if (!id) continue;
      const st = this.states.get(id);
      if (st && st.transparency > 0.8 && !this.selected.has(id)) continue;
      const mesh = h.object as THREE.Mesh;
      const material = Array.isArray(mesh.material) ? mesh.material[h.face?.materialIndex ?? 0] : mesh.material;
      if (outsideClip(h.point, this.renderer.clippingPlanes) || (material?.clippingPlanes && outsideClip(h.point, material.clippingPlanes))) continue;
      return { id, point: h.point };
    }
    return null;
  }

  /** Draw motion paths (and an in-progress path being edited). */
  setPathOverlay(paths: MotionPath[], draft: [number, number, number][] = []) {
    this.overlay.clear();
    const draw = (pts: [number, number, number][], color: string) => {
      if (pts.length === 0) return;
      const lifted = pts.map(([x, y, z]) => new THREE.Vector3(x, y + 0.05, z));
      if (pts.length > 1) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lifted), new THREE.LineBasicMaterial({ color, depthTest: false }));
        line.renderOrder = 10;
        this.overlay.add(line);
      }
      const dot = new THREE.SphereGeometry(0.35, 12, 8);
      const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
      for (const v of lifted) {
        const m = new THREE.Mesh(dot, mat);
        m.position.copy(v);
        m.renderOrder = 11;
        this.overlay.add(m);
      }
    };
    for (const p of paths) draw(p.points, "#7c3aed");
    draw(draft, "#ff7a00");
    this.needsRender = true;
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  requestRender() {
    this.needsRender = true;
  }
}

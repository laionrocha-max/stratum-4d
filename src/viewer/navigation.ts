import { Box3, Quaternion, Vector3, type Plane } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** OrbitControls looks at its target on every update. Keep the view rotation
 * relative to that target so changing the pivot leaves the image steady. */
export class PivotOrbitControls extends OrbitControls {
  readonly viewOffset = new Quaternion();

  override update(deltaTime?: number | null): boolean {
    const changed = super.update(deltaTime);
    // The base constructor runs update before the subclass is initialized.
    if (this.viewOffset) {
      this.object.quaternion.multiply(this.viewOffset);
      this.object.updateMatrixWorld();
    }
    return changed;
  }

  stopInertia() {
    const position = this.object.position.clone();
    const target = this.target.clone();
    const damping = this.enableDamping;
    this.enableDamping = false;
    super.update();
    this.enableDamping = damping;
    this.target.copy(target);
    this.object.position.copy(position);
    this.update();
  }

  setPivot(pivot: Vector3) {
    if (this.target.distanceToSquared(pivot) < 1e-14 || this.object.position.distanceToSquared(pivot) < 1e-14) return;
    const rotation = this.object.quaternion.clone();
    this.stopInertia();
    this.target.copy(pivot);
    super.update();
    this.viewOffset.copy(this.object.quaternion).invert().multiply(rotation).normalize();
    this.object.quaternion.copy(rotation);
    this.object.updateMatrixWorld();
  }
}

const axes = ["x", "y", "z"] as const;

/** Section, segment and growth planes in this viewer are axis aligned. */
export function clipNavigationBounds(box: Box3, planes: readonly Plane[]): Box3 {
  if (box.isEmpty()) return box;
  for (const plane of planes) {
    const axis = axes.find((key) => Math.abs(plane.normal[key]) > 1 - 1e-8);
    if (!axis) continue;
    const direction = plane.normal[axis];
    const boundary = -plane.constant / direction;
    if (direction > 0) box.min[axis] = Math.max(box.min[axis], boundary);
    else box.max[axis] = Math.min(box.max[axis], boundary);
  }
  return box;
}

export function outsideClip(point: Vector3, planes: readonly Plane[]): boolean {
  return planes.some((plane) => plane.distanceToPoint(point) < -1e-6);
}

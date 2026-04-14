import { MathUtils, Vector3 } from "three";

export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): Vector3 {
  const phi = MathUtils.degToRad(90 - lat);
  const theta = MathUtils.degToRad(lng + 180);
  return new Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function isPointFacingCamera(
  pointOnSphere: Vector3,
  cameraPosition: Vector3,
  threshold = 0.2
): boolean {
  const sphereNormal = pointOnSphere.clone().normalize();
  const cameraDir = cameraPosition.clone().normalize();
  return sphereNormal.dot(cameraDir) > threshold;
}

import { useEffect, useMemo } from "react";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function RoundedPart({
  size,
  position,
  color,
  metalness = 0,
  radius = 0.16,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  metalness?: number;
  radius?: number;
}) {
  const [width, height, depth] = size;
  const geometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        width,
        height,
        depth,
        4,
        Math.min(radius, width / 2, height / 2, depth / 2),
      ),
    [width, height, depth, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position}>
      <meshStandardMaterial
        color={color}
        roughness={metalness ? 0.28 : 0.36}
        metalness={metalness}
      />
    </mesh>
  );
}

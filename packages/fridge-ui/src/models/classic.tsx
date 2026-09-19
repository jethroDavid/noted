import { RoundedPart } from "./rounded-part";

export function ClassicFridge() {
  return (
    <>
      <RoundedPart
        size={[5.95, 9.25, 1.5]}
        position={[0.12, 0, -0.5]}
        color="#9caa9c"
      />
      <RoundedPart
        size={[5.78, 9.2, 0.8]}
        position={[-0.04, 0.04, 0]}
        color="#d4dbca"
      />
      <RoundedPart
        size={[5.62, 2.32, 0.35]}
        position={[-0.06, 3.36, 0.5]}
        color="#e3e7d6"
      />
      <RoundedPart
        size={[5.62, 6.65, 0.35]}
        position={[-0.06, -1.24, 0.5]}
        color="#e3e7d6"
      />
      <RoundedPart
        size={[0.12, 1.2, 0.17]}
        position={[-2.45, 3.06, 0.76]}
        color="#869080"
        metalness={0.55}
      />
      <RoundedPart
        size={[0.12, 1.6, 0.17]}
        position={[-2.45, 0.6, 0.76]}
        color="#869080"
        metalness={0.55}
      />
      <RoundedPart
        size={[0.18, 1.32, 0.18]}
        position={[-2.47, 3.12, 0.82]}
        color="#eeeee3"
        metalness={0.4}
      />
      <RoundedPart
        size={[0.18, 1.72, 0.18]}
        position={[-2.47, 0.66, 0.82]}
        color="#eeeee3"
        metalness={0.4}
      />
      <RoundedPart
        size={[0.55, 0.18, 0.6]}
        position={[-1.95, -4.64, -0.1]}
        color="#5f685d"
      />
      <RoundedPart
        size={[0.55, 0.18, 0.6]}
        position={[1.95, -4.64, -0.1]}
        color="#5f685d"
      />
    </>
  );
}

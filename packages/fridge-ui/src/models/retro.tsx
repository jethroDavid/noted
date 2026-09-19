import { RoundedPart } from "./rounded-part";

export function RetroFridge() {
  return (
    <>
      <RoundedPart
        size={[5.95, 9.25, 1.7]}
        position={[0.12, 0, -0.5]}
        color="#b6a374"
        radius={0.55}
      />
      <RoundedPart
        size={[5.78, 9.15, 1.1]}
        position={[-0.04, 0.04, 0]}
        color="#e0c791"
        radius={0.5}
      />
      <RoundedPart
        size={[5.55, 8.96, 0.9]}
        position={[-0.06, 0.04, 0.42]}
        color="#f4dfac"
        radius={0.44}
      />
      <RoundedPart
        size={[0.24, 2.2, 0.23]}
        position={[-2.42, 1.3, 0.98]}
        color="#aa9370"
        metalness={0.55}
      />
      <RoundedPart
        size={[0.34, 1.9, 0.3]}
        position={[-2.42, 1.4, 1.12]}
        color="#f6edd7"
        metalness={0.65}
      />
      <RoundedPart
        size={[0.55, 0.24, 0.6]}
        position={[-1.95, -4.64, -0.1]}
        color="#88754f"
      />
      <RoundedPart
        size={[0.55, 0.24, 0.6]}
        position={[1.95, -4.64, -0.1]}
        color="#88754f"
      />
    </>
  );
}

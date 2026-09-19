import { RoundedPart } from "./rounded-part";

export function DuoFridge() {
  return (
    <>
      <RoundedPart
        size={[5.95, 9.25, 1.5]}
        position={[0.12, 0, -0.5]}
        color="#748f9c"
        radius={0.06}
      />
      <RoundedPart
        size={[5.78, 9.2, 0.8]}
        position={[-0.04, 0.04, 0]}
        color="#a3beca"
        radius={0.06}
      />
      <RoundedPart
        size={[2.77, 2.32, 0.35]}
        position={[-1.49, 3.36, 0.5]}
        color="#c6dde5"
        radius={0.05}
      />
      <RoundedPart
        size={[2.77, 2.32, 0.35]}
        position={[1.37, 3.36, 0.5]}
        color="#c6dde5"
        radius={0.05}
      />
      <RoundedPart
        size={[5.62, 6.65, 0.35]}
        position={[-0.06, -1.24, 0.5]}
        color="#c6dde5"
        radius={0.05}
      />
      {[-0.3, 0.18].map((x) => (
        <RoundedPart
          key={x}
          size={[0.09, 0.94, 0.17]}
          position={[x, 3.1, 0.78]}
          color="#647f8c"
          metalness={0.65}
          radius={0.04}
        />
      ))}
      <RoundedPart
        size={[4.6, 0.1, 0.15]}
        position={[-0.06, 1.88, 0.79]}
        color="#647f8c"
        metalness={0.65}
        radius={0.04}
      />
      <RoundedPart
        size={[5.25, 0.18, 0.6]}
        position={[-0.02, -4.64, -0.1]}
        color="#536c77"
        radius={0.04}
      />
    </>
  );
}

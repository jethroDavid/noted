"use client";

export function HomeSceneIcon({
  scene,
  className = "",
}: {
  scene: "fridge" | "tv" | "book";
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {scene === "tv" ? (
        <>
          <path d="M8 11 Q24 8 40 10 L41 35 Q24 38 7 35Z M12 14 Q25 12 36 14 L36 29 Q24 31 12 29Z M15 39 L34 39 M12 33 L25 33" />
          <circle cx="35" cy="33" r="1.5" />
        </>
      ) : scene === "fridge" ? (
        <>
          <path d="M14 5 Q25 3 35 5 L36 42 L13 42Z M14 18 L35 18 M18 10 L18 14 M18 23 L18 31 M17 45 L17 42 M32 45 L32 42" />
          <path d="M24 25 L31 26 L30 34 L23 33Z" />
        </>
      ) : (
        <>
          <path d="M24 10 Q14 6 4 9 L5 38 Q15 35 24 39 Q34 35 44 38 L44 9 Q34 6 24 10Z M24 10 L24 39 M9 14 L19 13 L19 23 L9 24Z M29 15 L39 14 M29 20 L39 19 M29 25 L38 24 M10 29 L19 28" />
        </>
      )}
    </svg>
  );
}

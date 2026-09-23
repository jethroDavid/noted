/** Bold-ink toon surface: flat fills, cel shades, gray hardware. */
export function FlatBoard() {
  const ink = "#3f362b";
  return (
    <div className="board-flat" aria-hidden="true">
      <svg viewBox="0 0 700 1000" preserveAspectRatio="xMidYMid meet">
        {/* Feet peek out below the body. */}
        <rect x="170" y="954" width="44" height="18" rx="8" fill="#4a4234" />
        <rect x="486" y="954" width="44" height="18" rx="8" fill="#4a4234" />

        {/* Body mass with a flat darker side face. */}
        <rect
          x="60"
          y="40"
          width="580"
          height="916"
          rx="14"
          fill="#eadfc3"
          stroke={ink}
          strokeWidth="5"
        />
        <path
          d="M612,40 H626 Q640,40 640,54 V942 Q640,956 626,956 H612 Z"
          fill="#bfae87"
        />
        <line x1="612" y1="42" x2="612" y2="954" stroke={ink} strokeWidth="5" />

        {/* Doors with flat cel shade at their bases. */}
        <rect
          className="board-flat-door"
          x="78"
          y="62"
          width="522"
          height="336"
          rx="8"
          fill="#efe4c9"
          stroke={ink}
          strokeWidth="4"
        />
        <path
          d="M78,360 H600 V390 Q600,398 592,398 H86 Q78,398 78,390 Z"
          fill="#d9c69e"
        />
        <rect x="78" y="401" width="522" height="12" rx="6" fill="#4a4234" />
        <rect
          className="board-flat-door"
          x="78"
          y="414"
          width="522"
          height="478"
          rx="8"
          fill="#efe4c9"
          stroke={ink}
          strokeWidth="4"
        />
        <path
          d="M78,830 H600 V884 Q600,892 592,892 H86 Q78,892 78,884 Z"
          fill="#d9c69e"
        />

        {/* Gray handles with a light core. */}
        <rect
          x="98"
          y="96"
          width="22"
          height="200"
          rx="11"
          fill="#a8ada9"
          stroke={ink}
          strokeWidth="4"
        />
        <rect
          x="104"
          y="106"
          width="6"
          height="180"
          rx="3"
          fill="#e8ecec"
          opacity="0.85"
        />
        <rect
          x="98"
          y="448"
          width="22"
          height="260"
          rx="11"
          fill="#a8ada9"
          stroke={ink}
          strokeWidth="4"
        />
        <rect
          x="104"
          y="458"
          width="6"
          height="240"
          rx="3"
          fill="#e8ecec"
          opacity="0.85"
        />

        {/* Solid dark kick plate. */}
        <rect x="110" y="908" width="400" height="26" rx="10" fill="#4a4234" />
      </svg>
    </div>
  );
}

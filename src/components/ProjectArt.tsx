import type { ProjectArt as Art } from '../content';

const common = {
  viewBox: '0 0 320 160',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

function Crossings() {
  const crossings = [55, 125, 195, 265];
  return (
    <svg {...common}>
      <path d="M20 50 C32 50,45 60,55 80 C75 120,105 120,125 80 C145 40,175 40,195 80 C215 120,245 120,265 80 C275 60,288 50,300 50" />
      <path
        d="M20 110 C32 110,45 100,55 80 C75 40,105 40,125 80 C145 120,175 120,195 80 C215 40,245 40,265 80 C275 100,288 110,300 110"
        strokeDasharray="0.5 9"
        strokeWidth={4}
        opacity={0.6}
      />
      <circle cx="20" cy="50" r="6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="110" r="6" fill="currentColor" stroke="none" opacity={0.6} />
      {crossings.map((x) => (
        <g key={x}>
          <circle cx={x} cy="80" r="10" fill="var(--tile-bg)" />
          <circle cx={x} cy="80" r="3.5" fill="currentColor" stroke="none" />
        </g>
      ))}
    </svg>
  );
}

function Waterfront() {
  const waves = [124, 138, 152];
  return (
    <svg {...common}>
      <path d="M88 110 H192" />
      <path d="M102 84 L140 52 L178 84" />
      <path d="M112 76 V110 M168 76 V110" />
      <path d="M133 110 V94 H147 V110" />
      {waves.map((y, i) => (
        <path
          key={y}
          d={`M${40 + i * 12} ${y} q15 -8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0`}
          opacity={1 - i * 0.25}
        />
      ))}
      <path d="M232 86 C232 86 212 64 212 52 A20 20 0 0 1 252 52 C252 64 232 86 232 86 Z" fill="var(--tile-bg)" />
      <circle cx="232" cy="52" r="6" />
    </svg>
  );
}

function Plant() {
  return (
    <svg {...common}>
      <path d="M126 112 H194 L186 150 H134 Z" fill="var(--tile-bg)" />
      <path d="M160 112 V70" />
      <path d="M160 94 C138 94 122 80 122 60 C144 60 160 74 160 94 Z" fill="currentColor" fillOpacity={0.18} />
      <path d="M160 78 C182 78 198 64 198 44 C176 44 160 58 160 78 Z" fill="currentColor" fillOpacity={0.18} />
      <path d="M236 36 C236 36 218 58 218 70 A18 18 0 0 0 254 70 C254 58 236 36 236 36 Z" />
      <path d="M230 72 A7 7 0 0 0 237 79" opacity={0.6} />
      <circle cx="84" cy="64" r="3" fill="currentColor" stroke="none" opacity={0.5} />
      <circle cx="98" cy="40" r="2.5" fill="currentColor" stroke="none" opacity={0.35} />
      <circle cx="272" cy="104" r="3" fill="currentColor" stroke="none" opacity={0.5} />
    </svg>
  );
}

function Search() {
  const scattered: [number, number][] = [
    [44, 40], [70, 110], [92, 62], [58, 134], [110, 128], [252, 36],
    [276, 92], [240, 132], [290, 54], [214, 26], [118, 30], [296, 128],
  ];
  const matches: [number, number][] = [[158, 66], [176, 80], [162, 88]];
  return (
    <svg {...common}>
      {scattered.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="currentColor" stroke="none" opacity={0.3} />
      ))}
      <circle cx="166" cy="76" r="38" fill="var(--tile-bg)" />
      {matches.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="currentColor" stroke="none" />
      ))}
      <path d="M194 104 L222 132" strokeWidth={8} />
    </svg>
  );
}

const art: Record<Art, () => React.JSX.Element> = {
  crossings: Crossings,
  waterfront: Waterfront,
  plant: Plant,
  search: Search,
};

export default function ProjectArt({ kind }: { kind: Art }) {
  const Art = art[kind];
  return <Art />;
}

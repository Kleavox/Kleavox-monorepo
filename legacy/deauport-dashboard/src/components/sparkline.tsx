type Point = number | null;

export function Sparkline({
  points,
  className = "",
  height = 40,
  strokeWidth = 2,
}: {
  points: Point[];
  className?: string;
  height?: number;
  strokeWidth?: number;
}) {
  const w = Math.max(80, points.length * 6);
  const vals = points.filter((v): v is number => v != null);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const span = Math.max(1, max - min);

  const path = points.map((v, i) => {
    const x = (i / Math.max(1, points.length - 1)) * (w - 2);
    const y = v == null ? null : height - 2 - ((v - min) / span) * (height - 4);
    return { x: x + 1, y };
  });

  let d = "";
  let dArea = "";
  let startedLine = false;
  let startedArea = false;
  let firstPointInSegment: { x: number; y: number } | null = null;
  let lastPointInSegment: { x: number; y: number } | null = null;

  for (const p of path) {
    if (p.y == null) {
      if (startedArea && firstPointInSegment && lastPointInSegment) {
        dArea += `L ${lastPointInSegment.x.toFixed(1)} ${height - 1} L ${firstPointInSegment.x.toFixed(1)} ${height - 1} Z `;
      }
      startedLine = false;
      startedArea = false;
      firstPointInSegment = null;
      lastPointInSegment = null;
      continue;
    }

    if (!startedLine) {
      d += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      startedLine = true;
    } else {
      d += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    }

    if (!startedArea) {
      dArea += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      startedArea = true;
      firstPointInSegment = { x: p.x, y: p.y };
    } else {
      dArea += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    }
    lastPointInSegment = { x: p.x, y: p.y };
  }
  
  if (startedArea && firstPointInSegment && lastPointInSegment) {
    dArea += `L ${lastPointInSegment.x.toFixed(1)} ${height - 1} L ${firstPointInSegment.x.toFixed(1)} ${height - 1} Z`;
  }


  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={`block ${className}`} width={w} height={height}>
      <path d={dArea} fill="currentColor" opacity="0.15" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
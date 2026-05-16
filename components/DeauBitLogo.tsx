"use client";

interface DeauBitLogoProps {
  size?: number;
  className?: string;
}

export default function DeauBitLogo({ size = 48, className = "" }: DeauBitLogoProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 select-none ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <rect width="100" height="100" rx="22" fill="#a3e635" />
        <text
          x="50" y="75"
          textAnchor="middle"
          fill="#0a0a0a"
          stroke="#0a0a0a"
          strokeWidth="3"
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{
            fontSize: "68px",
            fontFamily: "'Arial Black', 'Arial Bold', Arial, sans-serif",
            fontWeight: 900,
          }}
        >D</text>
        <circle cx="76" cy="79" r="6" fill="#0a0a0a" opacity="0.3" />
        <text
          x="24" y="22"
          textAnchor="middle"
          fill="#0a0a0a"
          opacity={0.3}
          style={{
            fontSize: "13px",
            fontFamily: "Arial, sans-serif",
            fontWeight: 900,
          }}
        >v</text>
      </svg>
    </div>
  );
}

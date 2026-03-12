//components/DeauBitLogo.tsx

"use client";

type DeauBitLogoProps = { size?: number };

export default function DeauBitLogo({ size = 40 }: DeauBitLogoProps) {
  return (
    <div style={{ width: size, height: size }} className="relative">
      <div className="absolute inset-0 bg-(--db-text) translate-x-1 translate-y-1 opacity-50"></div>
      <div className="absolute inset-0 bg-(--db-primary) border-2 border-(--db-border) flex items-center justify-center">
        <span className="font-black text-(--db-primary-fg)" style={{ fontSize: size * 0.6 }}>D</span>
      </div>
    </div>
  );
}
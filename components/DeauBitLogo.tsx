// components/DeauBitLogo.tsx

"use client";

import React from "react";

interface DeauBitLogoProps {
  size?: number;
  className?: string;
}

export default function DeauBitLogo({ size = 48, className = "" }: DeauBitLogoProps) {
  return (
    <div 
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle 
          cx="50" 
          cy="50" 
          r="45" 
          stroke="currentColor" 
          strokeWidth="8" 
          className="text-(--db-text)"
        />
        
        <circle 
          cx="50" 
          cy="50" 
          r="12" 
          fill="#ea1506" 
          className="animate-pulse"
        />

        <text
          x="50%"
          y="52%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="currentColor"
          className="text-(--db-text) font-black"
          style={{ 
            fontSize: "32px", 
            fontFamily: "var(--font-dot), monospace",
            fontWeight: 900
          }}
        >
          DB
        </text>
      </svg>
    </div>
  );
}

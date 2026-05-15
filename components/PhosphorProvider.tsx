"use client";

import { IconContext } from "@phosphor-icons/react";

export default function PhosphorProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "bold", size: 16 }}>
      {children}
    </IconContext.Provider>
  );
}

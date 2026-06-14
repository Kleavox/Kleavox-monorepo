import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

export function reactApp(config: UserConfig = {}) {
  const { plugins = [], ...rest } = config;
  return defineConfig({ plugins: [react(), ...plugins], ...rest });
}

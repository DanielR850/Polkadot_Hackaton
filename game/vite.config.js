import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas: el bundle puede servirse desde cualquier subcarpeta.
  base: "./",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

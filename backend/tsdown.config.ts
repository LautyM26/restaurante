import { defineConfig } from "tsdown";

// Dependencies listed in package.json "dependencies" stay external by default.
export default defineConfig({
  entry: { server: "src/server.ts" },
  format: "esm",
  platform: "node",
  outDir: "dist",
  // Keep the .js extension (the node platform defaults to .mjs).
  fixedExtension: false,
});

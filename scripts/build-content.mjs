import { build } from "esbuild";

const shared = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  legalComments: "none",
  logLevel: "info"
};

await Promise.all([
  build({ ...shared, entryPoints: ["src/content/index.ts"], outfile: "dist/content.js" }),
  build({ ...shared, entryPoints: ["src/content/early.ts"], outfile: "dist/early-content.js" }),
]);

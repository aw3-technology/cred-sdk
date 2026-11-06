import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

const common = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "neutral",
  target: "es2020",
  sourcemap: true,
};
await build({ ...common, format: "esm", outfile: "dist/index.js" });
await build({ ...common, format: "cjs", outfile: "dist/index.cjs" });

execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { stdio: "inherit" });

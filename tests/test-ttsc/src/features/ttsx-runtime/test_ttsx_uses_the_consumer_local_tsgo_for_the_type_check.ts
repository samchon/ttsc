import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createFakeNativePreview,
  spawnWithoutTsgoOverride,
} from "../../internal/toolchain";

/**
 * Verifies ttsx type-checks through the consumer-local tsgo.
 *
 * ttsx resolves `tsgo` from the project's own `@typescript/native-preview`
 * install for the type-check (its `--noEmit` gate), exactly as ts-node uses the
 * project's installed TypeScript. Emission is a separate concern, performed by
 * the driver host (unified with the plugin path), so the consumer tsgo is asked
 * only to check, never to emit.
 *
 * 1. Install a scripted stub `@typescript/native-preview` that logs its args.
 * 2. Run ttsx without the workspace tsgo override (`spawnWithoutTsgoOverride`).
 * 3. Assert the stub ran the `--noEmit` check (never an emit) and the entry then
 *    ran from its driver-emitted source.
 */
export const test_ttsx_uses_the_consumer_local_tsgo_for_the_type_check = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        outDir: "dist",
        rootDir: ".",
      },
      include: ["src"],
    }),
    "src/index.ts": `console.log("ran-from-driver-emit");\n`,
  });
  const logFile = path.join(root, "tsgo.log");
  createFakeNativePreview(
    root,
    `
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, args.join(" ") + "\\n");
if (args.includes("--version")) {
  console.log("Version 7.0.0-dev.CONSUMER-SMOKE");
  process.exit(0);
}
// A consumer tsgo invoked by ttsx only ever type-checks (--noEmit); it never
// emits, so this stub simply succeeds without writing output.
process.exit(0);
`,
  );

  const result = spawnWithoutTsgoOverride(
    TestProject.TTSX_BIN,
    ["src/index.ts"],
    {
      cwd: root,
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "ran-from-driver-emit");
  const log = fs.readFileSync(logFile, "utf8");
  assert.match(log, /--noEmit/, "the consumer tsgo ran the type-check");
  assert.doesNotMatch(
    log,
    /--outDir/,
    "the consumer tsgo is never asked to emit",
  );
};

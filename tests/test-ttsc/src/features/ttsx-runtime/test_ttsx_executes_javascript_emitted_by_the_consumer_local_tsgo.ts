import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createFakeNativePreview,
  spawnWithoutTsgoOverride,
} from "../../internal/toolchain";

/**
 * Verifies ttsx executes JavaScript emitted by the consumer-local tsgo.
 *
 * Ttsx resolves the native compiler from the project's own `typescript` install
 * rather than from the workspace binary. This test replaces that install with a
 * scripted stub that writes a custom `.js` file and logs its arguments, so we
 * can confirm both that ttsx used it and that the resulting `.js` was
 * executed.
 *
 * 1. Install a fake `typescript` into the project.
 * 2. Run ttsx without the workspace tsgo override (`spawnWithoutTsgoOverride`).
 * 3. Assert the fake tsgo's output was executed (not the original source).
 */
export const test_ttsx_executes_javascript_emitted_by_the_consumer_local_tsgo =
  () => {
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
      "src/index.ts": `console.log("source-should-not-run");\n`,
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
const noEmitAt = args.indexOf("--noEmit");
const noEmit = noEmitAt >= 0 && args[noEmitAt + 1] !== "false";
if (!noEmit) {
  const outDirAt = args.indexOf("--outDir");
  const outDir = outDirAt >= 0 ? args[outDirAt + 1] : path.join(${JSON.stringify(root)}, "dist");
  const out = path.join(outDir, "src", "index.js");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, "console.log(\\"consumer-local-tsgo\\");\\n", "utf8");
}
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
    assert.equal(result.stdout.trim(), "consumer-local-tsgo");
    assert.match(fs.readFileSync(logFile, "utf8"), /--outDir/);
  };

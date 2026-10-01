import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isolatedCacheEnvironment } from "../../internal/isolated-cache-environment";
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
 * @evidence contracts/testing.md#behavioral-verification Ttsx without workspace binary overrides must run the consumer-local scripted compiler output consumer-local-tsgo, and its compiler log must include --outDir.
 * @evidence contracts/testing.md#independent-expectations The source instead prints source-should-not-run; the distinct authored compiler output independently identifies execution of selected emitted bytes.
 * @evidence contracts/testing.md#distinguishing-cases Scripted --version, effective --showConfig, --listFilesOnly, noEmit and outDir handling exercise compiler selection and the public source/emitted-file reporting protocol, not TypeScript parsing or type correctness.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_executes_javascript_emitted_by_the_consumer_local_tsgo entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary The real launcher resolves an installed compiler-shaped executable and executes its emitted JavaScript. The scripted compiler is a protocol fixture; this entry does not prove real compiler evaluation.
 * @evidence contracts/e2e.md#shared-execution One consumer host and one fixture script use toolchain.scriptLauncher, a shared once-per-test-process Go forwarding binary copied to the install. The launcher build is genuine preparation, while the authored compiler payload is JavaScript.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Overrides are removed only in the child environment and isolatedCacheEnvironment names a fixture-owned cache. TestProject tracks consumer and shared forwarding-producer temp directories until process exit.
 * @evidence contracts/e2e.md#preserved-coverage Original status, exact emitted-output text and --outDir log assertion remain; showConfig and listFilesOnly log assertions additionally verify the selected producer's supported provenance inspections. Compiler-local discovery and emitted-byte execution remain without certifying scripted compiler semantics as real compilation.
 */
export function test_ttsx_executes_javascript_emitted_by_the_consumer_local_tsgo() {
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
const source = ${JSON.stringify(path.join(root, "src", "index.ts"))};
if (args.includes("--version")) {
  console.log("Version 7.0.0-dev.CONSUMER-SMOKE");
  process.exit(0);
}
if (args.includes("--showConfig")) {
  const outDirAt = args.indexOf("--outDir");
  console.log(JSON.stringify({
    compilerOptions: {
      target: "es2022", module: "commonjs", rootDir: ".",
      outDir: outDirAt >= 0 ? args[outDirAt + 1] : "dist",
    },
    files: [source],
  }));
  process.exit(0);
}
if (args.includes("--listFilesOnly")) {
  console.log(source);
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
  if (args.includes("--listFiles")) console.log(source);
  if (args.includes("--listEmittedFiles")) console.log("TSFILE: " + out);
}
`,
    );

    const result = spawnWithoutTsgoOverride(
      TestProject.TTSX_BIN,
      ["src/index.ts"],
      {
        cwd: root,
        env: isolatedCacheEnvironment(root),
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "consumer-local-tsgo");
    assert.match(fs.readFileSync(logFile, "utf8"), /--outDir/);
    assert.match(fs.readFileSync(logFile, "utf8"), /--showConfig/);
    assert.match(fs.readFileSync(logFile, "utf8"), /--listFilesOnly true/);
  }

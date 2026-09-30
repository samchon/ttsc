import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs the entry from source, so `__dirname` is the source
 * directory rather than the configured `outDir`.
 *
 * Ttsx is a ts-node-style runner: it type-checks and builds the project, then
 * executes the entry _at its source path_ with the build served under that URL.
 * A file that exists only in the source tree (never emitted) must therefore be
 * readable relative to `__dirname`. This pins the run-from-source contract that
 * lets `DynamicExecutor`-style harnesses discover sibling `.ts` files by
 * `__dirname`.
 *
 * 1. Create a CommonJS project with `outDir: "dist"` and a `marker.txt` that lives
 *    only under `src/`.
 * 2. Run ttsx against the entry, which reads `__dirname + "/marker.txt"`.
 * 3. Assert the source-only file was found and printed.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx executes CommonJS main and an imported class module; both source-only marker and parent-relative template reads must print their exact literals.
 * @evidence contracts/testing.md#independent-expectations Ttsx runs source URLs rather than deployed outDir paths; marker.txt exists only beside source, so an emitted-directory identity cannot pass. Literal template content independently verifies the class-derived parent lookup.
 * @evidence contracts/testing.md#distinguishing-cases Source-sibling marker distinguishes source from dist, while imported TestGlobal exercises a second module's dirname and parent-relative asset. The no-outDir corpus still owns its separate no-adjacent-JavaScript assertion.
 * @evidence contracts/testing.md#execution-ownership One filename-matching named E2E function connects the actual native compiler and CommonJS loader to source-relative filesystem reads; both authored modules are input fixtures rather than test hosts.
 * @evidence contracts/e2e.md#necessary-boundary Native CommonJS execution must supply the source module's dirname after serving cached compiler emit; returning a source path from a resolver unit cannot prove that runtime global binding and real file read.
 * @evidence contracts/e2e.md#shared-execution The existing stronger source-only marker host now also owns the former configured-outDir corpus class/asset lookup, sharing one immutable compiler workspace and host instead of another project and launcher.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The isolated fixture has no emitted marker or copied assets that could satisfy wrong-directory reads; synchronous spawn ends its only process and TestProject owns directory cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original zero-exit and source-relative-dirname output remain, and the original configured corpus dirname-preserved class-based file read now executes in this host. Its old same-depth src/bin layout could not distinguish its erroneous emitted-path claim; the source-only marker strengthens that oracle.
 */
export function test_ttsx_dirname_points_at_the_source_directory_not_the_outdir() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/marker.txt": "source-relative-dirname",
      "template/data.txt": "dirname-preserved",
      "src/TestGlobal.ts": `declare const __dirname: string;\nexport class TestGlobal { public static readonly ROOT: string = __dirname + "/.."; }\n`,
      "src/main.ts": [
        `import { TestGlobal } from "./TestGlobal";`,
        `declare const __dirname: string;`,
        `declare function require(name: string): {`,
        `  readFileSync(file: string, encoding: string): string;`,
        `};`,
        `const fs = require("node:fs");`,
        `console.log(fs.readFileSync(__dirname + "/marker.txt", "utf8"));`,
        `console.log(fs.readFileSync(TestGlobal.ROOT + "/template/data.txt", "utf8"));`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), [
      "source-relative-dirname",
      "dirname-preserved",
    ]);
  }

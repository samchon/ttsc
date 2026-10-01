import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "./TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "./plugin-cache";

let completed: { source: string; javascriptMap: string; declarationMap: string } | undefined;
let failed: { error: unknown } | undefined;

/**
 * Returns one immutable external-map emit for the coordinate and embedded-source cases.
 *
 * Both cases have the same authored source and four-line preamble. Enabling
 * inlineSources preserves the coordinate obligations while adding the embedded
 * bytes; declaration output joins the same compiler load.
 *
 * @evidence contracts/common.md#principled-implementation The actual launcher emits a shared fixed fixture; only completed output bytes are retained, so each consumer checks real native output with independent assertions.
 * @evidence contracts/common.md#clear-and-simple-design One owner prepares the common source/options, captures the two map sidecars and exposes only immutable strings after releasing the project.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No transform or expectation is replaced; assertions remain in the two named consumers, and initial preparation failures are rethrown rather than retried against a warm result.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the compatible option combination, coordinate and embedded-byte responsibilities, and released fixture lifetime.
 * @evidence contracts/performance.md#efficient-algorithms One compiler invocation and two map reads serve the two consumers; retained memory is bounded by source and emitted map bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Fixture source, preamble and compiler options remain identical between consumers. The memoized result is local to one test process; unchanged compiler/plugin artifacts use the content-keyed shared cache.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.join paths locate config, source and map files; the existing TestProject launcher handles Windows versus POSIX process execution and the directory owner removes only its own temporary fixture.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The finally path releases the owned temporary project after success or failure; retained immutable output or initial error ends with the suite process, and no child process survives the synchronous spawn.
 */
export function bannerMapBoundaryResult(): { source: string; javascriptMap: string; declarationMap: string } {
  if (failed) throw failed.error;
  if (completed) return completed;
  const source = [
    "export const alpha: number = 1;",
    "export const beta: number = 2;",
    "export function gamma(x: number): number {",
    "  return x + alpha + beta;",
    "}",
    "",
  ].join("\n");
  let root: string | undefined;
  try {
    root = TestProject.commonJsProject(
    {
      "banner.config.cjs": `module.exports = { text: "Copyright\\nMIT License\\nthird line\\nfourth line" };\n`,
      "src/main.ts": source,
    },
    {
      compilerOptions: {
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        inlineSources: true,
        plugins: [{ transform: "@ttsc/banner", configFile: "banner.config.cjs" }],
      },
    },
  );
    TestBanner.seedPackage(root);
    const result = TestProject.spawn(TestProject.TTSC_BIN, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: TestBanner.goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    if (result.status !== 0) throw new Error(`banner map preparation failed: ${result.stderr}`);
    completed = {
      source: fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
      javascriptMap: fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8"),
      declarationMap: fs.readFileSync(path.join(root, "dist", "main.d.ts.map"), "utf8"),
    };
    return completed;
  } catch (error) {
    failed = { error };
    throw error;
  } finally {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
}

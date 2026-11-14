import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";

const { execFile } = E2eProcessTrace;

/**
 * Verifies a real Bun process leaves the modules a `filter` does not select to
 * Bun, in the runtime and in `Bun.build`.
 *
 * Bun's `onLoad` result contract differs between releases. Bun 1.4.4 throws
 * `TypeError: onLoad() expects an object returned` when a runtime callback
 * returns `undefined`, and only later builds accept it, so no stub of the `Bun`
 * global can show that a skipped module still loads. The pattern also carries
 * the `g` flag, which makes a shared `RegExp` skip every other selected module,
 * so the filter selects two modules and leaves a third.
 *
 * The native fixture producer transforms only `src/main.ts`. A selected module
 * that the producer returns no output for is loaded untransformed and reported
 * on stderr, so that report shows a module reached ttsc and its absence shows a
 * module did not.
 *
 * 1. Write a selected `extra.ts` and an unselected `left.ts` beside the fixture's
 *    `main.ts`, and a runtime script that calls `register({ filter })`.
 * 2. Run the script under Bun and assert `main.ts` is transformed, `extra.ts` is
 *    reported as untransformed, and `left.ts` loads without a report.
 * 3. Run a `Bun.build` of the same three modules through the adapter with the same
 *    filter and assert the same split in the bundle and on stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   The runtime child prints PLUGIN for main.ts and loads left.ts and extra.ts,
 *   and the build child bundles all three with PLUGIN for main.ts, so each
 *   of the three modules is observed through an executed result.
 * @evidence contracts/testing.md#independent-expectations
 *   The expected PLUGIN literal and module values come from the fixture's
 *   authored source, and the stderr report is the adapter's documented
 *   diagnostic for a project file the native envelope omits, not a value
 *   the filter computes.
 * @evidence contracts/testing.md#distinguishing-cases
 *   A transformed module, a selected module the producer omits and an unselected
 *   module separate a stateful `g` match, a skipped module that crashes
 *   the loader and a filter that selects everything.
 * @evidence contracts/testing.md#execution-ownership
 *   The test-e2e runner discovers test_bun_filter_runs_under_real_bun through
 *   test_e2e_scenarios_batch. The actual Bun child owns the runtime registration
 *   and the build. Portable selection, ordering and lock assertions execute at
 *   tests/test-unplugin/src/features/adapters/test_bun_filter_leaves_unselected_modules_to_bun.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Only a real Bun process shows whether its loader accepts the callback result
 *   for a skipped module, which varies by release.
 * @evidence contracts/e2e.md#shared-execution
 *   Each of the two children runs one registration or one build over the same
 *   three modules; the native producer and cache are the shared default fixture.
 *   Fewer processes cannot cover both host entry points.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   The test prepares its own project unless a prepared root is supplied, and
 *   each child is awaited under a 120 second timeout before any assertion reads
 *   its result. A runtime registration locks its options, so the build runs in
 *   a separate child.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The runtime and build outcomes replace no earlier assertion; the portable
 *   parts of the contract stay with their unit tests.
 */
export async function test_bun_filter_runs_under_real_bun(
  preparedRoot?: string,
): Promise<void> {
  const root = fs.realpathSync.native(
    preparedRoot ?? TestUnpluginProject.createProject(),
  );
  const library = path.dirname(TestUnpluginRuntime.libPath("bun", "mjs"));
  const adapter = (name: string) =>
    JSON.stringify(pathToFileURL(path.join(library, name)).href);
  const filter = String.raw`/src\/(?:main|extra)\.ts$/g`;
  TestProject.writeFiles(root, {
    "src/extra.ts": 'export const value: string = "extra";\n',
    "src/left.ts": 'export const value: string = "left";\n',
    "runtime.mjs": [
      `import { register } from ${adapter("bun-register.mjs")};`,
      `register({ filter: ${filter} });`,
      'await import("./src/main.ts");',
      'const extra = await import("./src/extra.ts");',
      'const left = await import("./src/left.ts");',
      "console.log(JSON.stringify([extra.value, left.value]));",
    ].join("\n"),
    "entry.mjs": [
      'import "./src/main.ts";',
      'import { value as extra } from "./src/extra.ts";',
      'import { value as left } from "./src/left.ts";',
      "console.log(extra, left);",
    ].join("\n"),
    "build.mjs": [
      `import ttsc from ${adapter("bun.mjs")};`,
      `const plugin = ttsc({ filter: ${filter} });`,
      'const result = await Bun.build({ entrypoints: ["./entry.mjs"], plugins: [plugin], target: "bun" });',
      "if (!result.success) throw new Error(result.logs.join(String.fromCharCode(10)));",
      "console.log(await result.outputs[0].text());",
    ].join("\n"),
  });
  const run = promisify(execFile);
  const binary = process.env.TTSC_BUN_BINARY ?? "bun";
  const options = {
    cwd: root,
    env: process.env,
    timeout: 120_000,
    windowsHide: true,
  };
  const reported = (stderr: string, file: string) =>
    new RegExp(
      `${file.replace(".", "\\.")} is not part of the program described by`,
    ).test(stderr);

  const runtime = await run(binary, ["runtime.mjs"], options);
  assert.deepEqual(runtime.stdout.trim().split(/\r?\n/), [
    "PLUGIN",
    JSON.stringify(["extra", "left"]),
  ]);
  assert.equal(reported(runtime.stderr, "extra.ts"), true, runtime.stderr);
  assert.equal(reported(runtime.stderr, "left.ts"), false, runtime.stderr);

  const build = await run(binary, ["build.mjs"], options);
  assert.match(build.stdout, /"PLUGIN"/);
  assert.doesNotMatch(build.stdout, /goUpper/);
  assert.match(build.stdout, /"extra"/);
  assert.match(build.stdout, /"left"/);
  assert.equal(reported(build.stderr, "extra.ts"), true, build.stderr);
  assert.equal(reported(build.stderr, "left.ts"), false, build.stderr);
}

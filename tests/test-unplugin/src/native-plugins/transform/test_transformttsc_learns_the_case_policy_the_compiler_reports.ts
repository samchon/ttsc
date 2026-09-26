import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a transform generation takes the case policy the compiler reported,
 * and keeps it for the project's next compile.
 *
 * The adapter matched root specs case-insensitively everywhere but Linux, while
 * TypeScript-Go decides from the filesystem its executable lives on, so on a
 * case-sensitive macOS volume or a case-insensitive Linux one the two disagreed
 * on which files belong to the program (samchon/ttsc#1545). The compiler now
 * reports its policy in the graph, the capture adopts it, and a walk taken
 * before the compile under another policy is taken again.
 *
 * 1. Transform with a plugin whose graph reports the policy this platform does not
 *    ordinarily have, the report of a compiler on the other kind of volume.
 * 2. Assert the attempt was taken again under the reported policy: two compiles.
 * 3. Edit the module and transform again through the same cache: the policy primes
 *    the walk, so one compile.
 */
export async function test_transformttsc_learns_the_case_policy_the_compiler_reports(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-case-policy-"),
    "compiles.bin",
  );
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "graph",
        operation: "emit-graph",
        echoTsconfig: true,
        useCaseSensitiveFileNames: process.platform !== "linux",
      },
      {
        transform: "./plugin.cjs",
        name: "runs",
        operation: "count-runs",
        runLog,
      },
    ],
  });
  const cache = createTtscTransformCache();
  const compiles = (): number =>
    fs.existsSync(runLog) ? fs.statSync(runLog).size : 0;
  const main = TestUnpluginProject.mainFile(root);
  const deliver = () =>
    transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    );

  assert.ok(await deliver());
  assert.equal(compiles(), 2, "the walk is taken again under the policy");

  fs.writeFileSync(
    main,
    fs
      .readFileSync(main, "utf8")
      .replace(/goUpper\("([^"]*)"\)/, 'goUpper("$1x")'),
  );
  assert.ok(await deliver());
  assert.equal(compiles(), 3, "the learned policy primes the next walk");
}

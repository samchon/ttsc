import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

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
 * 1. Transform with a plugin whose graph reports the policy opposite to the one
 *    the compiler's own rule answers here
 *    (`compilerUsesCaseSensitiveFileNames`, samchon/ttsc#1563), the report of a
 *    compiler on the other kind of volume.
 * 2. Assert the attempt was taken again under the reported policy: two compiles.
 * 3. Edit the module and transform again through the same cache: the policy primes
 *    the walk, so one compile.
 *
 * @evidence contracts/testing.md#behavioral-verification Opposite reported case policy costs two initial compiles, then learned policy primes one compile after a source edit.
 * @evidence contracts/testing.md#independent-expectations Native run counts are independent; the opposite fixture report is calculated from the owning compiler rule and cannot independently verify that rule.
 * @evidence contracts/testing.md#distinguishing-cases First policy disagreement versus later learned policy under the same cache distinguishes retry from permanent recompilation.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_learns_the_case_policy_the_compiler_reports in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Opposite reported case policy costs two initial compiles, then learned policy primes one compile after a source edit. These assertions remain in test_transformttsc_learns_the_case_policy_the_compiler_reports, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
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
        useCaseSensitiveFileNames: !compilerUsesCaseSensitiveFileNames({
          projectRoot: root,
        }),
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

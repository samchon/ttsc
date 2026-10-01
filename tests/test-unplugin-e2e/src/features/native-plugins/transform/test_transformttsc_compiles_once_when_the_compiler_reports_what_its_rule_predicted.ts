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
 * Verifies a first delivery compiles once when the compiler reports the case
 * policy its own rule predicted.
 *
 * The walk before a project's first compile is primed with the answer the
 * compiler will give, which ttsc computes by TypeScript-Go's rule
 * (`compilerUsesCaseSensitiveFileNames`, samchon/ttsc#1563). A walk primed with
 * the platform's ordinary answer instead was taken again whenever the
 * compiler's volume behaved otherwise (samchon/ttsc#1545).
 *
 * 1. Transform with a plugin whose graph reports the policy the rule answers.
 * 2. Assert the first delivery compiled once.
 *
 * @evidence contracts/testing.md#behavioral-verification The first native delivery compiles once when the envelope case-policy report equals the adapter prediction.
 * @evidence contracts/testing.md#independent-expectations The run-log byte independently counts compiles; compilerUsesCaseSensitiveFileNames supplies the fixture input and therefore this case does not independently prove that rule correct.
 * @evidence contracts/testing.md#distinguishing-cases Matching report is the positive no-retry twin of the opposite-policy learning case.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_compiles_once_when_the_compiler_reports_what_its_rule_predicted in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The first native delivery compiles once when the envelope case-policy report equals the adapter prediction. These assertions remain in test_transformttsc_compiles_once_when_the_compiler_reports_what_its_rule_predicted, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_compiles_once_when_the_compiler_reports_what_its_rule_predicted(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-case-rule-"),
    "compiles.bin",
  );
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "graph",
        operation: "emit-graph",
        echoTsconfig: true,
        useCaseSensitiveFileNames: compilerUsesCaseSensitiveFileNames({
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
  const main = TestUnpluginProject.mainFile(root);
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      createTtscTransformCache(),
    ),
  );
  assert.equal(
    fs.existsSync(runLog) ? fs.statSync(runLog).size : 0,
    1,
    "the first walk was taken again",
  );
}

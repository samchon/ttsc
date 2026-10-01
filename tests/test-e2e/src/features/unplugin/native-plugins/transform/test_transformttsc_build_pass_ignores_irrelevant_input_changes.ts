import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../../../internal/unplugin/internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../../internal/unplugin/internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies irrelevant file edits and newly emitted directories share one generation.
 *
 * An existing undeclared text file and a newly created ignored directory exercise
 * different halves of the pass proof: content and membership. Both must preserve
 * the same captured native output. A subsequent admitted-source edit verifies
 * that reuse did not disable invalidation. Each original negative case retains
 * its failure identity and runs even if another assertion fails.
 *
 * 1. Plant the text file and capture one graph-bearing native generation.
 * 2. Rewrite the text file and create all four ignored output directories in
 *    separately reported passes, requiring the invocation count to stay one.
 * 3. Edit an admitted source and require exactly one replacement and later reuse.
 * 4. Aggregate the phase failures and release the shared cache in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification deliverPass returns transformed output for every original module in every phase. Rewriting build-log.txt and creating populated dist/out/coverage/.cache leave the native log at one invocation; an admitted module edit raises it to two and the next unchanged pass stays at two.
 * @evidence contracts/testing.md#independent-expectations The fixture declares admitted source inputs but never build-log.txt or emitted bundle.js. Literal one/one/two/two counts come from sidecar log bytes, independently of adapter content and membership digests; the source counterexample rejects unconditional reuse.
 * @evidence contracts/testing.md#distinguishing-cases Owns existing irrelevant content churn and absent-to-present ignored directory membership, then contrasts an actual admitted input edit and unchanged replacement reuse. Source creation/removal and undelivered type-only edits retain their separate entries.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner discovers this native transform entry; its named phases own the assertions formerly in a_build_pass_ignores_an_undeclared_project_file_edit, a_build_pass_ignores_an_appearing_output_directory and a_build_pass_recompiles_after_a_module_edit. Direct source metadata memo semantics execute separately in test-unplugin units.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API launches the counting Go sidecar and consumes its graph across real delivery-pass boundaries. The invocation log proves native envelope admission and generation reuse; this synthetic producer does not establish native compiler graph semantics.
 * @evidence contracts/e2e.md#shared-execution Exactly one startDeliveryPassSession, root, options, log and cache serve all three original cases. Three original cold captures become one; only the final admitted-source change requires a replacement invocation, reducing four original native invocations to two. The Go fixture source and native artifact are reused through the existing shared cache.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The text file is planted before the single cold capture. Each later phase mutates disjoint undeclared or ignored paths while admitted inputs stay unchanged until the positive control. Failures are collected independently; finally resets the cache and releases its trackers, while TestProject owns temporary roots until runner exit.
 * @evidence contracts/e2e.md#preserved-coverage The shared original cold count and both literal one-invocation assertions, rewritten text bytes, four directory names and emitted JavaScript bytes remain. The original module edit bytes and two/reuse-two counts retain their phase. deliverPass retains every-module output assertions, and all three original failure identities are aggregated.
 */
export async function test_transformttsc_build_pass_ignores_irrelevant_input_changes(): Promise<void> {
  const session = await startDeliveryPassSession();
  const failures: Error[] = [];
  const phase = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  };
  try {
    const note = path.join(session.root, "src", "build-log.txt");
    fs.writeFileSync(note, "first\n", "utf8");
    await deliverPass(session);
    await phase("shared cold generation", async () => {
      assert.equal(session.compiles(), 1);
    });

    await phase("test_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit", async () => {
      fs.writeFileSync(note, "second, longer than the first\n", "utf8");
      await deliverPass(session);
      assert.equal(
        session.compiles(),
        1,
        "a project file the generation never declared as an input must not cost a compile",
      );
    });

    await phase("test_transformttsc_a_build_pass_ignores_an_appearing_output_directory", async () => {
      for (const ignored of ["dist", "out", "coverage", ".cache"]) {
        const directory = path.join(session.root, ignored);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, "bundle.js"), "// emitted", "utf8");
      }
      await deliverPass(session);
      assert.equal(
        session.compiles(),
        1,
        "a bundler creating its own output directory must not void the generation",
      );
    });

    await phase("test_transformttsc_a_build_pass_recompiles_after_a_module_edit", async () => {
      fs.appendFileSync(session.modules[0]!, "\nexport const added = 1;\n", "utf8");
      await deliverPass(session);
      assert.equal(session.compiles(), 2, "an edited module must replace the generation exactly once");
      await deliverPass(session);
      assert.equal(session.compiles(), 2, "the pass after the edit must reuse the replacement");
    });
    if (failures.length !== 0)
      throw new AggregateError(failures, "Irrelevant-input native batch failed");
  } finally {
    session.close();
  }
}

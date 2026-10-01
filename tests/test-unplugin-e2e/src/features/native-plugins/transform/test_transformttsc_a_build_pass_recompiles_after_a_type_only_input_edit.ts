import assert from "node:assert/strict";
import fs from "node:fs";

import { deliverPass } from "../../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass recompiles when a type-only input changes, although the
 * bundler never delivers that file.
 *
 * This is the input class the reference graph exists for. A bundler erases a
 * type-only edge from its module graph, so only the generation's recorded
 * snapshot can notice the edit, and a retained generation that missed it would
 * serve code compiled against the old type.
 *
 * 1. Run a pass and assert one compile.
 * 2. Edit the module reached only through a type-only edge.
 * 3. Open a pass, deliver another module, and assert the project recompiled.
 *
 * @evidence contracts/testing.md#behavioral-verification After an initial pass, the last graph-reachable source is appended and the next pass delivers only the first module. Transformed output must be returned and native invocation count rise from one to two despite no delivery of the edited input.
 * @evidence contracts/testing.md#independent-expectations The declared type-only input remains a compiler dependency after bundler edge erasure. Literal one-to-two counts from the independent sidecar log require invalidation without relying on the adapter graph traversal to construct an expected set; output type semantics are not examined here.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged initial pass contrasts with an undelivered graph-input edit. Direct module edits are covered separately, and unrelated text-file edits provide the negative declared-input control.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_build_pass_recompiles_after_a_type_only_input_edit in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startDeliveryPassSession uses createCacheProject, which materializes one shared Go counting sidecar source and reuses the suite native build cache. One fresh project, options and cache serve every pass in this entry; only changed Program inputs require another native invocation, not another installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session owns unique project and run-log directories; successive passes intentionally share the cache and mutate only this project. The sidecar log starts absent and counts this scenario alone. finally calls session.close to reset the cache and release trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_build_pass_recompiles_after_a_type_only_input_edit; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_build_pass_recompiles_after_a_type_only_input_edit(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // A sibling reached only through the fixture's graph edges, never through
    // an import the bundler could see, and never delivered in this pass.
    const typeOnly = session.modules[session.modules.length - 1]!;
    fs.appendFileSync(typeOnly, "\nexport const shifted = true;\n", "utf8");

    session.pass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.compiles(),
      2,
      "an edited type-only input must replace the generation before the next pass delivers anything",
    );
  } finally {
    session.close();
  }
}

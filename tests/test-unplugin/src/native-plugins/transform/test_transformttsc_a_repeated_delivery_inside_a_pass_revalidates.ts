import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a module delivered twice inside one pass revalidates on its second
 * delivery.
 *
 * The constant-time shortcut is a statement about a module's first delivery in
 * a pass. A bundler asking again is the one signal the pass itself provides
 * that something may have moved, so the retained generation must not answer it
 * from the pass gate.
 *
 * 1. Open a pass and deliver a module.
 * 2. Change the plugin descriptor.
 * 3. Deliver the same module again and assert it recompiles.
 *
 * @evidence contracts/testing.md#behavioral-verification The same module is delivered twice within one pass, with a plugin.cjs append between requests. Both results must exist and the native run-log count must move from one to two, exposing a first-delivery shortcut incorrectly reused for a repeat request.
 * @evidence contracts/testing.md#independent-expectations The descriptor is a universal generation input, so its changed bytes require a fresh capture even when module source holds. The sidecar log independently records invocations; literal one-to-two count avoids reproducing descriptor-hash comparison.
 * @evidence contracts/testing.md#distinguishing-cases A first delivery in a pass is the fast-path baseline, while a second delivery after descriptor mutation must revalidate. First deliveries of other modules are covered by the avoids-rehashing entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_repeated_delivery_inside_a_pass_revalidates in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startDeliveryPassSession uses createCacheProject, which materializes one shared Go counting sidecar source and reuses the suite native build cache. One fresh project, options and cache serve every pass in this entry; only changed Program inputs require another native invocation, not another installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session owns unique project and run-log directories; successive passes intentionally share the cache and mutate only this project. The sidecar log starts absent and counts this scenario alone. finally calls session.close to reset the cache and release trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_repeated_delivery_inside_a_pass_revalidates; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_repeated_delivery_inside_a_pass_revalidates(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    const first = session.modules[0]!;
    session.pass();
    assert.ok(await session.deliver(first));
    assert.equal(session.compiles(), 1);

    fs.appendFileSync(
      path.join(session.root, "plugin.cjs"),
      "\n// changed inside the pass\n",
      "utf8",
    );
    assert.ok(await session.deliver(first));
    assert.equal(
      session.compiles(),
      2,
      "a module delivered twice in one pass must validate on its second delivery",
    );
  } finally {
    session.close();
  }
}

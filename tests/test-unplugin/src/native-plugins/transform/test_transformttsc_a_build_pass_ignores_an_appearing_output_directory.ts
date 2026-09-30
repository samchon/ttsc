import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass keeps the generation when a bundler creates its output
 * directory inside the project.
 *
 * The membership proof has to honour the same ignore rules the walk does. A
 * directory's own stamp moves whenever any entry is added or removed, so
 * comparing raw directory metadata meant a bundler emitting into `dist/`, or
 * merely creating it, voided a generation no compiler input had touched. That
 * is what every host that writes its bundle into the project does on its first
 * build. The negative twin is
 * `test_transformttsc_a_build_pass_recompiles_after_a_membership_change`.
 *
 * 1. Run a pass and assert one compile.
 * 2. Create `dist`, `out`, `coverage`, and `.cache` holding emitted JavaScript.
 * 3. Run another pass and assert it reuses the generation.
 *
 * @evidence contracts/testing.md#behavioral-verification deliverPass invokes transformTtsc before and after dist, out, coverage and .cache are created with emitted bundle.js files; the native log remains exactly one invocation, catching output-directory creation invalidating an unchanged generation.
 * @evidence contracts/testing.md#independent-expectations These four output locations contain no admitted source input, so the Program membership contract requires reuse. The sidecar appends a byte per invocation; literal one-before/one-after counts are independent of membership digest computation. This checks reuse, not emitted bundle execution.
 * @evidence contracts/testing.md#distinguishing-cases A settled initial pass contrasts with newly appearing ignored output directories, all four populated with JavaScript. Real source creation is the complementary membership-change entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_build_pass_ignores_an_appearing_output_directory in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startDeliveryPassSession uses createCacheProject, which materializes one shared Go counting sidecar source and reuses the suite native build cache. One fresh project, options and cache serve every pass in this entry; only changed Program inputs require another native invocation, not another installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session owns unique project and run-log directories; successive passes intentionally share the cache and mutate only this project. The sidecar log starts absent and counts this scenario alone. finally calls session.close to reset the cache and release trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_build_pass_ignores_an_appearing_output_directory; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_build_pass_ignores_an_appearing_output_directory(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

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
  } finally {
    session.close();
  }
}

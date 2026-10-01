import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { waitFor } from "../../../internal/adapter-vite-serve/waitFor";
import { createRealNativeEnvelopeFixture } from "../../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { programRuns } from "../../../internal/real-native-envelope/programRuns";

/**
 * Verifies a persistent host answers a module outside the program from its
 * watchers instead of walking the project on every delivery
 * (samchon/ttsc#1398).
 *
 * Every delivery of such a module used to re-walk the project and re-hash every
 * out-of-walk input to confirm it was still outside the program, even though
 * the generation's live watchers already prove that neither membership nor any
 * input had changed. A page load that requests many such modules paid that walk
 * per module.
 *
 * 1. Compile a real native envelope in a persistent cache, then deliver a module
 *    outside the program's `include` twenty times, and assert no directory was
 *    listed.
 * 2. Add a source to the program and assert a later delivery recompiles.
 *
 * @evidence contracts/testing.md#behavioral-verification Twenty excluded-module requests return undefined with zero listings and one native program invocation; adding admitted source later triggers a second invocation.
 * @evidence contracts/testing.md#independent-expectations Literal scripts/tool.ts is outside include and independent listing/run counters measure work; newly added source is the positive invalidation control.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged excluded delivery versus project membership change distinguishes legitimate fast rejection from stale program reuse.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_out_of_program_deliveries_skip_the_walk_while_watched in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The public transform API connects to the actual linked utility host and its compiler-produced program envelope. Filesystem identity, membership and registration assertions require that real producer-consumer agreement; direct envelope selector units cannot prove native graph delivery.
 * @evidence contracts/e2e.md#shared-execution One real-envelope contributor source and content-addressed native build cache are shared by suite consumers. This case owns its project/run log and uses the same native producer for its deliveries; changed declaration or membership state requires a new program invocation, not another consumer installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup. The stderr hook is restored in finally.
 * @evidence contracts/e2e.md#preserved-coverage Twenty excluded-module requests return undefined with zero listings and one native program invocation; adding admitted source later triggers a second invocation. These assertions remain in test_transformttsc_out_of_program_deliveries_skip_the_walk_while_watched, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_out_of_program_deliveries_skip_the_walk_while_watched(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  let listings = 0;
  const cache = api.createTtscTransformCache({
    readdir: (location: string) => {
      listings += 1;
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  const stray = path.join(fixture.root, "scripts", "tool.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  fs.writeFileSync(stray, "export const tool: string = 'STRAY';\n");
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    assert.ok(await deliver(fixture.modules[0]!));
    assert.equal(programRuns(fixture.runLog), 1);
    await new Promise((resolve) => setImmediate(() => setImmediate(resolve)));

    listings = 0;
    for (let index = 0; index < 20; index += 1) {
      assert.equal(await deliver(stray), undefined);
    }
    assert.equal(listings, 0, "the watchers answer for an unchanged program");

    fs.writeFileSync(
      path.join(path.dirname(fixture.modules[0]!), "added.ts"),
      "export const added = 1;\n",
    );
    await waitFor(async () => {
      await deliver(stray);
      return programRuns(fixture.runLog) === 2;
    }, "a membership change to reach an out-of-program delivery");
  } finally {
    process.stderr.write = original;
  }
}

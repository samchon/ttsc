import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a cached project generation is withdrawn when an environment
 * variable its plugin read changes between two module deliveries, and is still
 * reused when the plugin did not read it.
 *
 * A plugin that removes trace calls unless `NODE_ENV` is `test` lowers the
 * whole project by the value it reads through `ctx.Env`, and the envelope
 * records that read. The cache key cannot name the variable, so the delivery
 * coordinator must compare the record with the delivery's compiler environment,
 * even for a module's first delivery in a pass, which otherwise shares the
 * pass's proof without reading the disk.
 *
 * 1. Cache one generation of a two-module project whose envelope recorded the
 *    variable as `test` and kept the trace call.
 * 2. Deliver the first module under `test` and assert the generation serves.
 * 3. Deliver the second module under `production` and assert the generation is
 *    evicted for a recompile.
 * 4. Repeat with a generation whose plugin read nothing and assert the second
 *    module is still served under `production`.
 *
 * @evidence contracts/testing.md#behavioral-verification Production selectCachedGenerationAction, the decision transformTtsc makes for every cached delivery, serves or evicts the exact cached Promise; a changed recorded read must leave the cache empty with a capture verdict.
 * @evidence contracts/testing.md#independent-expectations The recorded value, the delivery environments and the lowered outputs are literals; module baselines are SHA-256 hashes computed here from the authored text.
 * @evidence contracts/testing.md#distinguishing-cases Equal value serves, changed value recompiles, and the same change with a generation that recorded no read keeps serving. Both modules are first deliveries in the pass, the path where no disk proof runs. Shared-store adoption belongs to test_shared_compile_adopts_only_under_the_recorded_environment; native recording belongs to the Go utility tests.
 * @evidence contracts/testing.md#execution-ownership Unit test over a temporary project and a handwritten generation that stands for the native envelope; no native producer or compiler runs, so the recompile itself is asserted as the capture verdict rather than executed.
 */
export function test_cached_delivery_recompiles_when_a_recorded_environment_read_changes(): void {
  const failures: Error[] = [];
  for (const variant of ["reads", "ignores"] as const) {
    const fixture = createCachedDeliveryUnitFixture();
    try {
      const root = fixture.good.projectRoot;
      const otherSource = 'trace("other");\nexport const other = 2;\n';
      const other = path.join(root, "src", "other.ts");
      fs.writeFileSync(other, otherSource, "utf8");
      const result: ITtscCompilerTransformation.ISuccess = {
        type: "success",
        typescript: {
          "src/main.ts": fixture.code,
          "src/other.ts": otherSource,
        },
        ...(variant === "reads"
          ? { environmentInputs: { TTSC_TEST_LOWERING_MODE: "test" } }
          : {}),
      };
      const cached = {
        ...fixture.good,
        inputHashes: {
          ...fixture.good.inputHashes,
          "src/other.ts": createHash("sha256")
            .update(otherSource)
            .digest("hex"),
        },
        result,
      };
      const generation = Promise.resolve(cached);
      fixture.cache.set(fixture.key, generation);
      const deliver = (
        file: string,
        source: string,
        environment: NodeJS.ProcessEnv,
      ) =>
        selectCachedGenerationAction({
          cache: fixture.cache,
          cached,
          environment,
          epoch: 1,
          file,
          generation,
          key: fixture.key,
          source,
        });

      assert.equal(
        deliver(fixture.file, fixture.source, {
          TTSC_TEST_LOWERING_MODE: "test",
        }),
        "serve",
      );
      assert.equal(fixture.cache.get(fixture.key), generation);
      const second = deliver(other, otherSource, {
        TTSC_TEST_LOWERING_MODE: "production",
      });
      if (variant === "reads") {
        assert.equal(second, "capture", "a changed read recompiles");
        assert.equal(fixture.cache.size, 0);
      } else {
        assert.equal(second, "serve", "an unread variable is not an input");
        assert.equal(fixture.cache.get(fixture.key), generation);
      }
    } catch (error) {
      failures.push(new Error(variant, { cause: error }));
    } finally {
      fixture.dispose();
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "environment delivery variants failed");
}

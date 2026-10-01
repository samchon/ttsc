import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import { cachedGeneration } from "../../internal/transform-terminal-verdict/cachedGeneration";

/**
 * Verifies a module the compile has no output for does not fail the pass or
 * evict its generation.
 *
 * `selectTransformedSource` throws from three places, and only two of them say
 * anything about the generation. The third says one file has no output, an
 * ordinary condition for a module the bundle reaches but the tsconfig program
 * does not contain. Retaining that as a pass verdict would reject every later
 * module with an error about a file none of them asked for, and evicting the
 * generation would make each recompile the whole project to reach the same
 * answer (samchon/ttsc#1303). The generation compiled fine, so it is left where
 * it is.
 *
 * 1. Open a pass and deliver a project module.
 * 2. Deliver a file outside the program and assert it is left to the host while
 *    the generation survives.
 * 3. Deliver the remaining modules and assert they are served from that
 *    generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored transformTtsc delivers a recorded successful three-module consumer generation, returns undefined for an out-of-program file, preserves the exact cached Promise and still serves both sibling modules.
 * @evidence contracts/testing.md#independent-expectations A literal output map contains exactly the three src modules and no outside/helper.ts. Supported host fallback is undefined, while identity equality distinguishes a missing-output fallback from failure or generation eviction without computing expected values from the selector.
 * @evidence contracts/testing.md#distinguishing-cases A present module precedes one existing file excluded by include src, then two present siblings prove the excluded module did not poison the pass. The fixture is established before observation, separating absence of program output from a membership mutation.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the actual delivery coordinator over literal successful consumer metadata and real resolver files; no compiler, contributor or product host is built or substituted. Actual capture-to-native-output connection remains in test_transformttsc_failed_generation_recovery_batch and test_transformttsc_unavailable_notifications_keep_the_persistent_cache.
 */
export async function test_transformttsc_an_out_of_program_module_does_not_fail_the_pass(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const project = { root };
  const modules = [fixture.file];
  for (let index = 1; index < 3; index += 1) {
    const file = path.join(root, "src", "module" + index + ".ts");
    fs.writeFileSync(file, fixture.source);
    fixture.good.result.typescript["src/module" + index + ".ts"] = fixture.code;
    modules.push(file);
  }
  // Under the project root but outside the tsconfig's `include: ["src"]`, so
  // the program has no entry for it. Planted before the first delivery, since
  // creating it later would be a membership change instead.
  const outside = path.join(project.root, "outside", "helper.ts");
  fs.mkdirSync(path.dirname(outside), { recursive: true });
  fs.writeFileSync(outside, "export const helper = 1;\n", "utf8");

  const { api, cache, options } = fixture;
  const observed = observeValidationUnitGeneration(root, fixture.good.result);
  observed.deliveryEpoch = 1;
  cache.set(fixture.key, Promise.resolve(observed));
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  try {
    assert.ok(await deliver(modules[0]!));
    const generation = cachedGeneration(cache);

    assert.equal(
      await deliver(outside),
      undefined,
      "a module the program does not contain is left to the host, not failed",
    );
    assert.equal(
      cachedGeneration(cache),
      generation,
      "a generation that compiled fine must survive a module it has no output for",
    );

    for (const file of modules.slice(1)) {
      assert.ok(
        await deliver(file),
        `${path.basename(file)} must still be served after an out-of-program module`,
      );
    }
  } finally {
    fixture.dispose();
  }
}

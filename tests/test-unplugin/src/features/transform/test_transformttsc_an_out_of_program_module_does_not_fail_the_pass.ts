import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { notifyFailedGenerationInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyFailedGenerationInputs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";

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
 * @evidence contracts/testing.md#behavioral-verification Authored transformTtsc delivers a recorded successful three-module consumer generation, returns undefined for an out-of-program file, preserves the exact cached Promise and still serves both sibling modules; the pass-through routing config is handed over, a literal missing-output warning appears once per file/pass and a new pass reports again.
 * @evidence contracts/testing.md#independent-expectations A literal output map contains exactly the three src modules and no outside/helper.ts. Supported host fallback is undefined, while identity equality distinguishes a missing-output fallback from failure or generation eviction without computing expected values from the selector.
 * @evidence contracts/testing.md#distinguishing-cases A present module precedes one existing file excluded by include src, then two present siblings prove the excluded module did not poison the pass. Repeated same-file deliveries and the next pass additionally distinguish warning suppression from routing handoff. The exact stderr descriptor is restored in finally. The fixture is established before observation, separating absence of program output from a membership mutation.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the actual delivery coordinator over literal successful consumer metadata and real resolver files; no compiler, contributor or product host is built or substituted. Actual capture-to-native-output connection remains in test_transformttsc_failed_generation_recovery_batch and the shared native producer/consumer entry tests/test-e2e/src/features/test_e2e_metro_batch.ts#test_e2e_metro_batch.
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
  const stderrDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "write");
  const stderrWrite = process.stderr.write;
  const chunks: string[] = [];
  const batches: string[][] = [];
  process.stderr.write = ((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  const outsideDelivery = () => api.transformTtsc(
    outside, fs.readFileSync(outside, "utf8"), options, undefined, cache,
    { addWatchFiles: (inputs) => batches.push(inputs.map((input) => input.file)) },
  );
  try {
    assert.ok(await deliver(modules[0]!));
    const generation = cachedGeneration(cache);

    assert.equal(
      await outsideDelivery(),
      undefined,
      "a module the program does not contain is left to the host, not failed",
    );
    assert.equal(
      cachedGeneration(cache),
      generation,
      "a generation that compiled fine must survive a module it has no output for",
    );

    assert.equal(await outsideDelivery(), undefined);
    assert.equal(chunks.length, 1, "one missing-output warning per file and pass");
    const line = `ttsc: ${outside} is not part of the program described by ${path.join(root, "tsconfig.json")}, so it was left untransformed. Add it to that project's "include" if ttsc plugins should apply to it.\n`;
    assert.deepEqual(chunks, [line]);
    assert.equal(batches.length, 2);
    for (const inputs of batches)
      assert.ok(inputs.includes(path.join(root, "tsconfig.json")), "pass-through must retain its routing config");
    beginTtscTransformBuild(cache);
    assert.equal(await outsideDelivery(), undefined);
    assert.deepEqual(chunks, [line, line], "a new pass reports again");
    assert.equal(cachedGeneration(cache), generation);

    for (const file of modules.slice(1)) {
      assert.ok(
        await deliver(file),
        `${path.basename(file)} must still be served after an out-of-program module`,
      );
    }
    // A failed optional envelope also retains the config selection itself.
    const selectedConfig = path.join(root, "tsconfig.json");
    let recoveries = 0;
    notifyFailedGenerationInputs({
      addWatchFiles: (inputs, failed) => {
        ++recoveries;
        assert.equal(failed, true);
        assert.deepEqual(inputs.map((input) => input.file), [selectedConfig]);
        assert.equal(inputs[0]?.evidence?.missing, false);
        assert.deepEqual(inputs[0]?.evidence?.state, {
          codec: "host",
          hash: createHash("sha256").update(fs.readFileSync(selectedConfig)).digest("hex"),
        });
      },
    }, {
      inputHashes: {},
      membershipPolicy: observed.membershipPolicy,
      projectRoot: root,
      result: { type: "failure", typescript: {}, diagnostics: [] },
      tsconfig: selectedConfig,
    }, outside, {
      consulted: [],
      filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
      tsconfig: selectedConfig,
    });
    assert.equal(recoveries, 1);
  } finally {
    if (stderrDescriptor) Object.defineProperty(process.stderr, "write", stderrDescriptor);
    else delete (process.stderr as { write?: typeof process.stderr.write }).write;
    assert.equal(process.stderr.write, stderrWrite);
    fixture.dispose();
  }
}

import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { primeSuccessfulTransform } from "../../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies rejected and exceptional generations recover through one native project.
 *
 * Rejection and a resolved host exception reach different adapter failure owners.
 * Both must evict the failed generation and permit a real subsequent capture;
 * exception watch registration additionally retains aliases while excluding
 * scratch and message-derived paths. The first recovery's real successful
 * generation supplies the second phase rather than compiling another seed.
 *
 * 1. Capture and verify one native successful checkpoint.
 * 2. Exercise rejected-Promise eviction and actual successful retry.
 * 3. Exercise resolved-exception watches/eviction and actual successful retry.
 * 4. Collect both phase failures and dispose the cache on every exit.
 *
 * @evidence contracts/testing.md#behavioral-verification The built public transformTtsc traverses both failed-Promise and resolved-exception eviction paths, then actually captures recovered plugin output twice; exception watches assert alias preservation and exclusion of scratch/message-derived paths.
 * @evidence contracts/testing.md#independent-expectations Literal failure messages, zero/one cache sizes, PLUGIN/no-goUpper assertions, independently named alias paths and actual shared realpaths define the recovery and registration expectations; no production watch selector generates expected lists.
 * @evidence contracts/testing.md#distinguishing-cases A rejected Promise contrasts with a fulfilled exception envelope; both require successful retry. Two lexical aliases share one actual target but both must remain watched, while scratch and diagnostic-looking text must remain excluded.
 * @evidence contracts/testing.md#execution-ownership The single named native batch owns every assertion formerly in the two recovery entries. Its two independently reported phases execute through the real public API and Go fixture; the three Promise-authority scenarios now execute as direct source units.
 * @evidence contracts/e2e.md#necessary-boundary Actual recovery must connect an evicted failed generation to a fresh native plugin result rather than a handwritten successful response. Both failure channels and the real filesystem aliases retain their original observations here.
 * @evidence contracts/e2e.md#shared-execution One root, options, producer artifact and cache serve both failure phases. One initial native prime is shared, the first successful recovery becomes the second phase's checkpoint, and the two subsequent captures remain necessary to prove recovery.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Source, options and native producer inputs stay unchanged; each phase overwrites the cache with its own failed Promise/envelope. Only a fully asserted recovery replaces the checkpoint; on a phase assertion failure the original actual checkpoint remains available to the next phase. The delivery cache and an ownership ledger of actual generations are reset in finally, releasing checkpoints overwritten by planted failures as well as the final cached result.
 * @evidence contracts/e2e.md#preserved-coverage All original rejection, exception, alias-realpath, watch inclusion/exclusion, recovered-output and cache-size assertions remain in their respective phases; individual phase failures are collected before throwing so the second independent case still runs. Prime success/output/cache-size checks remain once at the common actual producer boundary.
 */
export async function test_transformttsc_failed_generation_recovery_batch(): Promise<void> {
  const { api, cache, key, good: initialGood, file, source, options } =
    await primeSuccessfulTransform();
  let checkpoint = initialGood;
  // Replacing an entry with a planted failure must not orphan its native handles.
  const ownedGenerations = new Map<string, Promise<unknown>>([
    ["initial", Promise.resolve(initialGood)],
  ]);
  const failures: Error[] = [];
  const phase = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  try {
    await phase("rejected-generation recovery", async () => {
      const rejected = Promise.reject(new Error("transient host failure"));
      rejected.catch(() => undefined); // suppress the unhandled-rejection warning
      cache.set(key, rejected);

      await assert.rejects(
        () => api.transformTtsc(file, source, options, undefined, cache),
        /transient host failure/,
      );
      assert.equal(cache.size, 0, "rejected generation must not stay cached");

      const recovered = await api.transformTtsc(
        file,
        source,
        options,
        undefined,
        cache,
      );
      const recoveredGeneration = cache.get(key);
      if (recoveredGeneration !== undefined) {
        ownedGenerations.set("recovery-1", recoveredGeneration);
      }
      assert.ok(recovered, "corrected retry must re-run the transform");
      TestUnpluginProject.assertTransformedToPlugin(recovered.code);
      assert.equal(cache.size, 1);
      checkpoint = await cache.get(key);
    });
    await phase("exception-generation recovery", async () => {
      const good = checkpoint;
      const projectRoot = (good as { projectRoot: string }).projectRoot;
      const scratchDirectory = (good as { scratchDirectory: string })
        .scratchDirectory;
      const falseDiagnostic = path.resolve(projectRoot, "foo.ts");
      const externalInputPaths = (good as { externalInputPaths: string[] })
        .externalInputPaths;
      const targetInput = externalInputPaths.find((input) => {
        try {
          return fs.statSync(input).isFile();
        } catch {
          return false;
        }
      });
      assert.ok(
        targetInput,
        "the primed generation must expose a regular external input for aliasing",
      );
      const targetDirectory = path.dirname(targetInput);
      const aliasDirectories = ["failure-watch-a", "failure-watch-b"].map((name) =>
        path.join(projectRoot, "node_modules", name),
      );
      fs.mkdirSync(path.dirname(aliasDirectories[0]!), { recursive: true });
      for (const alias of aliasDirectories) {
        fs.symlinkSync(
          targetDirectory,
          alias,
          process.platform === "win32" ? "junction" : "dir",
        );
      }
      const aliasInputs = aliasDirectories.map((alias) =>
        path.join(alias, path.basename(targetInput)),
      );
      assert.equal(
        fs.realpathSync.native(aliasInputs[0]!),
        fs.realpathSync.native(aliasInputs[1]!),
        "the failure-watch aliases must share one current physical target",
      );
      const scratchInput = path.join(scratchDirectory, "owned.tmp");
      const watched: string[] = [];

      cache.set(
        key,
        Promise.resolve({
          ...(good as Record<string, unknown>),
          externalInputPaths: [...externalInputPaths, ...aliasInputs],
          result: {
            type: "exception",
            error: new Error(
              `${scratchInput}:1:2 - error TS9000: scratch failure\nfoo.ts:1:2 - error while loading\nhost exploded`,
            ),
          },
        }),
      );

      await assert.rejects(
        () =>
          api.transformTtsc(file, source, options, undefined, cache, {
            addWatchFiles(inputs: readonly { file: string }[]) {
              watched.push(...inputs.map((input) => input.file));
            },
          }),
        /host exploded/,
      );
      assert.ok(
        !watched.includes(falseDiagnostic),
        `a generic exception line must not manufacture a diagnostic watch path; watched: ${watched.join(", ")}`,
      );
      assert.deepEqual(
        aliasInputs.filter((input) => watched.includes(input)),
        aliasInputs,
        "a failed generation must preserve every independently retargetable lexical alias",
      );
      assert.ok(
        !watched.includes(scratchInput),
        "a failed generation must not register its disposed scratch tree",
      );
      assert.equal(cache.size, 0, "resolved-exception generation must not persist");

      const recovered = await api.transformTtsc(
        file,
        source,
        options,
        undefined,
        cache,
      );
      const recoveredGeneration = cache.get(key);
      if (recoveredGeneration !== undefined) {
        ownedGenerations.set("recovery-2", recoveredGeneration);
      }
      assert.ok(recovered, "corrected retry must re-run the transform");
      TestUnpluginProject.assertTransformedToPlugin(recovered.code);
      assert.equal(cache.size, 1);
    });
    if (failures.length !== 0) {
      throw new AggregateError(failures, "Native recovery batch failed");
    }
  } finally {
    try {
      api.resetTtscTransformCache(cache);
    } finally {
      api.resetTtscTransformCache(ownedGenerations);
    }
  }
}

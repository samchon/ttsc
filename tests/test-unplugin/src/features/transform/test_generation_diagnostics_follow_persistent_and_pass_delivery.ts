import assert from "node:assert/strict";
import path from "node:path";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { createTransformCacheKey } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheKey";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { transformTtsc } from "../../../../../packages/unplugin/src/core/transform/transformTtsc";
import { TestProject } from "../../../../utils/src/TestProject";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies delivered generation diagnostics appear once for a persistent
 * generation and once in each explicitly started delivery pass.
 *
 * Literal successful envelopes provide warnings and output; real filesystem
 * observations establish their cache inputs. No native producer is primed or
 * its private generation copied to introduce a warning it never produced.
 *
 * 1. Seed four persistent modules or six pass-owned modules with a warning.
 * 2. Deliver every module twice and require one complete warning line.
 * 3. Replace the persistent generation or start another pass and require one
 *    further line; contrast an empty diagnostic list with no warning output.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual transformTtsc over four persistent or six pass-owned modules; exact delivered code and stderr lines verify coordinator-to-reporter ownership, duplicate suppression, a fresh generation and a new pass. An empty successful diagnostic list emits nothing.
 * @evidence contracts/testing.md#independent-expectations Authored module/output strings and a literal warning line fix every expectation. The observer helper records current filesystem inputs for setup, not the expected warning count or epoch decision.
 * @evidence contracts/testing.md#distinguishing-cases An initially undefined persistent epoch must report, same-generation repeats must stay quiet, a fresh generation must report and a retained generation in a later pass must report again. Empty success diagnostics cannot manufacture a failure message.
 * @evidence contracts/testing.md#execution-ownership This source entry constructs literal protocol results and observed cache generations, calls delivery directly and captures stderr in the sequential runner. Finally restores the exact original stderr-write descriptor and resets each cache. No compiler, Go process, plugin binary or native consumer host runs; real envelope production stays with E2E.
 */
export async function test_generation_diagnostics_follow_persistent_and_pass_delivery(): Promise<void> {
  for (const [persistent, count] of [[true, 4], [false, 6]] as const) {
    const modules = Array.from({ length: count }, (_, index) => `src/mod${index}.ts`);
    const source = "export const value = 1;\n";
    const output = 'export const value = "delivered";\n';
    const root = TestProject.createProject({
      "tsconfig.json": '{"include":["src"]}',
      ...Object.fromEntries(modules.map((file) => [file, source])),
    });
    const options = resolveOptions({});
    const cache = createTtscTransformCache();
    const key = createTransformCacheKey({
      aliasPaths: {},
      compilerOptions: options.compilerOptions,
      plugins: options.plugins,
      tsconfig: path.join(root, "tsconfig.json"),
    });
    const marker = persistent ? "PERSISTENT-WARNING" : "PASS-WARNING";
    const line = `src/mod0.ts: 1:1: ${marker}\n`;
    const seed = (warning: boolean): void => {
      cache.set(key, Promise.resolve(observeValidationUnitGeneration(root, {
        type: "success",
        typescript: Object.fromEntries(modules.map((file) => [file, output])),
        diagnostics: warning ? [{
          category: "warning",
          code: marker,
          file: "src/mod0.ts",
          line: 1,
          character: 1,
          messageText: marker,
        }] : [],
      })));
    };
    const descriptor = Object.getOwnPropertyDescriptor(process.stderr, "write");
    const captured: string[] = [];
    process.stderr.write = ((chunk: unknown) => {
      captured.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      if (!persistent) beginTtscTransformBuild(cache);
      seed(true);
      const deliverAll = async (): Promise<void> => {
        for (const file of modules) {
          assert.equal((await transformTtsc(path.join(root, file), source, options, undefined, cache))?.code, output);
        }
      };
      await deliverAll();
      await deliverAll();
      assert.deepEqual(captured, [line]);
      if (persistent) seed(true);
      else beginTtscTransformBuild(cache);
      await deliverAll();
      await deliverAll();
      assert.deepEqual(captured, [line, line]);
      seed(false);
      await deliverAll();
      assert.deepEqual(captured, [line, line], "empty success diagnostics add no text");
    } finally {
      if (descriptor === undefined) delete (process.stderr as { write?: unknown }).write;
      else Object.defineProperty(process.stderr, "write", descriptor);
      resetTtscTransformCache(cache);
    }
  }
}

import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a whole-project compile neither blocks the host's event loop nor
 * touches the host's environment (samchon/ttsc#1391, samchon/ttsc#1488).
 *
 * The compile used to run synchronously, plugin loading included, inside a
 * scope that pointed `TEMP`, `TMP`, and `TMPDIR` at the compile's scratch
 * directory. A dev server answered no other request for the whole compile. The
 * compile then moved to a worker thread, but the adapter still rewrote the
 * host's own variables around the call, because the worker adopted the host's
 * `process.env` rather than the compiler's `env`. The worker now takes the
 * compiler's `env`, which carries the scratch directory, so the host's
 * environment is never written at all. A sample of `process.env` could not
 * tell: the rewrite spanned one synchronous call, which no timer interrupts, so
 * the environment is observed by its writes instead.
 *
 * 1. Compile a project whose native transform holds for a known time, sampling the
 *    timer queue and recording every write to `process.env` until the compile
 *    resolves.
 * 2. Assert no stall came near the hold, and nothing wrote `TEMP`, `TMP`, or
 *    `TMPDIR`.
 */
export async function test_transformttsc_compile_leaves_the_event_loop_and_environment_free(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const hold = 1_500;
  const project = createCacheProject({ fileCount: 3, transformDelayMs: hold });
  const [file] = projectModules(project.root);

  const environment = process.env;
  const written: string[] = [];
  process.env = new Proxy(environment, {
    deleteProperty: (target, key) => {
      written.push(String(key));
      return Reflect.deleteProperty(target, key);
    },
    set: (target, key, value) => {
      written.push(String(key));
      return Reflect.set(target, key, value);
    },
  });
  const ticks: number[] = [];
  const timer = setInterval(() => ticks.push(performance.now()), 1);
  const started = performance.now();
  try {
    assert.ok(
      await transformTtsc(
        file!,
        fs.readFileSync(file!, "utf8"),
        resolveOptions(),
        undefined,
        createTtscTransformCache(),
      ),
    );
  } finally {
    clearInterval(timer);
    process.env = environment;
  }
  let longestStall = (ticks[0] ?? performance.now()) - started;
  for (let index = 1; index < ticks.length; index += 1) {
    longestStall = Math.max(longestStall, ticks[index]! - ticks[index - 1]!);
  }
  assert.ok(
    longestStall < hold / 2,
    `the loop ran throughout the compile: longest stall ${longestStall.toFixed(0)} ms`,
  );
  assert.deepEqual(
    written.filter((key) => ["TEMP", "TMP", "TMPDIR"].includes(key)),
    [],
    "the compile's scratch reaches the compiler through its env, never the host's",
  );
}

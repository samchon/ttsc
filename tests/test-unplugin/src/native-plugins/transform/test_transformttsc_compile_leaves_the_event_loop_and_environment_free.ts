import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a whole-project compile neither blocks the host's event loop nor
 * leaks its scratch environment into code that runs meanwhile
 * (samchon/ttsc#1391).
 *
 * The compile used to run synchronously, plugin loading included, inside a
 * scope that pointed `TEMP`, `TMP`, and `TMPDIR` at the compile's scratch
 * directory. A dev server answered no other request for the whole compile. The
 * compile now runs on a worker thread that adopts the scoped environment at the
 * call, so the scope ends as soon as the call returns.
 *
 * 1. Compile a project whose native transform holds for a known time, sampling the
 *    timer queue and `process.env.TEMP` until the compile resolves.
 * 2. Assert no stall came near the hold, and every sample saw the host's own
 *    `TEMP`.
 */
export async function test_transformttsc_compile_leaves_the_event_loop_and_environment_free(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const hold = 1_500;
  const project = createCacheProject({ fileCount: 3, transformDelayMs: hold });
  const [file] = projectModules(project.root);

  const original = process.env.TEMP;
  const seen = new Set<string | undefined>();
  const ticks: number[] = [];
  const timer = setInterval(() => {
    ticks.push(performance.now());
    seen.add(process.env.TEMP);
  }, 1);
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
    [...seen],
    [original],
    "code running during the compile sees the host's own environment",
  );
}

import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies a change landing after the loader read an input, but before
 * Turbopack took its baseline, still re-runs the module (samchon/ttsc#1423).
 *
 * Turbopack takes a loader dependency's state as its baseline only when it
 * processes the loader's result. A change in between is part of that baseline,
 * so Turbopack's own channel never reported it, and the page kept the older
 * output. The bridge now observes the input as well and rewrites the module's
 * sentinel, repeatedly, until the module runs again.
 *
 * 1. Run the loader on the entry module, whose plugin reports `src/types.d.ts`.
 * 2. Edit the declaration at once, as Turbopack would still hold the result.
 * 3. Assert the sentinel is rewritten, and rewritten again later, so one rewrite
 *    lands after any baseline Turbopack takes.
 * 4. Run the loader again, which delivers the changed state, and assert the
 *    rewrites stop.
 */
export async function test_turbopack_loader_signals_a_change_before_turbopacks_baseline(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const declaration = path.join(root, "src", "types.d.ts");
  fs.writeFileSync(declaration, "export type Before = string;\n");
  const run = () =>
    runTurbopackLoaderWithContext({
      resourcePath: TestUnpluginProject.mainFile(root),
      source: TestUnpluginProject.mainSource(root),
      options: { plugins: emitDependenciesPlugins(["src/types.d.ts"]) },
    });
  const first = await run();
  TestUnpluginProject.assertTransformedToPlugin(first.content);
  assert.ok(first.dependencies.includes(declaration));
  const sentinel = first.sentinels[0];
  assert.ok(sentinel !== undefined, "a watching delivery has a sentinel");
  const contents = () => fs.readFileSync(sentinel, "utf8");
  // The contents once they differ from `previous`, or after 20 seconds.
  const changedFrom = async (previous: string): Promise<string> => {
    const deadline = Date.now() + 20_000;
    for (;;) {
      const current = contents();
      if (current !== previous || Date.now() > deadline) return current;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const baseline = contents();
  fs.writeFileSync(declaration, "export type After = number;\n");
  const rewritten = await changedFrom(baseline);
  assert.notEqual(rewritten, baseline, "the change rewrites the sentinel");
  const repeated = await changedFrom(rewritten);
  assert.notEqual(repeated, rewritten, "the rewrite repeats");

  const second = await run();
  TestUnpluginProject.assertTransformedToPlugin(second.content);
  const delivered = contents();
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  assert.equal(
    contents(),
    delivered,
    "a run that delivered the changed state stops them",
  );
}

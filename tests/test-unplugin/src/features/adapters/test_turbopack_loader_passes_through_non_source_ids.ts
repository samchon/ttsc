import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the Turbopack loader applies the shared transform-target filter, not
 * a subset of it (samchon/ttsc#1305).
 *
 * The loader used to re-implement two of `isTransformTarget`'s four conditions,
 * so a rule glob wider than `*.ts`/`*.tsx` routed JavaScript and virtual ids
 * into the whole-project transform every other adapter excludes. A project
 * without `allowJs` has no program entry for such a file, so each delivery cost
 * a whole-project compile that could never produce output. The virtual row is
 * defence in depth: `transformTtsc` short-circuits a NUL id itself, and the row
 * pins that the loader no longer depends on a guard inside the transform.
 *
 * 1. Run the loader on `.js`, `.mjs`, `.cjs`, and `.jsx` siblings of a project
 *    source.
 * 2. Run it on a `\0` virtual id.
 * 3. Assert every source is returned unchanged.
 */
export async function test_turbopack_loader_passes_through_non_source_ids(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const script = 'export const value = goUpper("plugin");\n';
  for (const extension of ["js", "mjs", "cjs", "jsx"]) {
    const out = await runTurbopackLoader({
      resourcePath: path.join(root, "src", `sibling.${extension}`),
      source: script,
    });
    assert.equal(
      out,
      script,
      `a .${extension} module must pass through untouched, as every other adapter leaves it`,
    );
  }

  const virtual = "export const virtual = 1;\n";
  const virtualOut = await runTurbopackLoader({
    resourcePath: "\0virtual:module.ts",
    source: virtual,
  });
  assert.equal(
    virtualOut,
    virtual,
    "a virtual id must be filtered where every other adapter filters it",
  );
}

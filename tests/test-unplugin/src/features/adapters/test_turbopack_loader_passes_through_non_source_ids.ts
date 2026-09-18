import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the loader applies the shared transform-target filter, not a subset
 * of it (samchon/ttsc#1305).
 *
 * The loader used to re-implement two of `isTransformTarget`'s four conditions
 * while its docstring, the README and the website all claimed parity, so a rule
 * glob wider than `*.ts`/`*.tsx` — the natural thing to write for a project
 * with mixed sources, and the reason a loader needs a filter at all — routed
 * JavaScript and virtual ids into the whole-project transform every other
 * adapter excludes. A project without `allowJs` has no program entry for such a
 * file, so the delivery reached `selectTransformedSource` with nothing to
 * return, and under the per-delivery eviction each one cost a whole-project
 * compile first. That condition no longer fails a build (samchon/ttsc#1308),
 * but routing a file into a whole-project transform that can never produce
 * output for it is still work the filter exists to avoid.
 *
 * The four JavaScript rows are the regression guard: before the fix each of
 * them reached `selectTransformedSource` without output. The virtual row is
 * defence in depth rather than a second regression, because `transformTtsc`
 * short-circuits a NUL id itself, so the old loader also returned that source
 * untouched; what it pins is that the loader stops depending on a guard living
 * inside the transform. The declaration and `node_modules` rows both filters
 * already agreed on stay pinned by
 * {@link assertTurbopackLoaderPassesThroughFilteredPaths}.
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

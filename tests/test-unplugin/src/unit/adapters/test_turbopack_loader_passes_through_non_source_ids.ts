import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

import { runTurbopackLoader } from "../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the Turbopack loader applies the shared transform-target filter, not
 * a subset of it (samchon/ttsc#1305).
 *
 * The loader used to re-implement two of `isTransformTarget`'s four conditions,
 * so a rule glob wider than `*.ts`/`*.tsx` routed JavaScript and virtual ids
 * into the whole-project transform every other adapter excludes. A project
 * without `allowJs` has no program entry for such a file; that no longer fails
 * a build (samchon/ttsc#1308), but it still cost a whole-project compile that
 * could never produce output. The virtual row is defence in depth:
 * `transformTtsc` short-circuits a NUL id itself, and the row pins that the
 * loader no longer depends on a guard inside the transform. The declaration and
 * `node_modules` rows stay pinned by
 * `test_turbopack_loader_passes_through_declarations_and_node_modules`.
 *
 * 1. Run the loader on `.js`, `.mjs`, `.cjs`, and `.jsx` siblings of a project
 *    source.
 * 2. Run it on a `\0` virtual id.
 * 3. Assert every source is returned unchanged.
 * @evidence contracts/testing.md#behavioral-verification
 *   Calls the authored Turbopack loader with JavaScript and NUL virtual IDs;
 *   callback bytes must equal the supplied source instead of entering compilation.
 * @evidence contracts/testing.md#independent-expectations
 *   JavaScript and virtual IDs are excluded by the supported source contract.
 *   The exact supplied source is an independent byte-preservation expectation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   js, mjs, cjs and jsx spellings plus a TypeScript-shaped virtual ID detect
 *   extension-only or virtual-guard omissions. The companion declaration unit
 *   owns declaration/vendor exclusions; packed hosts own accepted transforms.
 * @evidence contracts/testing.md#execution-ownership
 *   test_turbopack_loader_passes_through_non_source_ids calls runTurbopackLoader for four JavaScript extensions and one NUL ID, owning each exact passthrough result and extension failure label; no native transform producer runs.
 */
export async function test_turbopack_loader_passes_through_non_source_ids(): Promise<void> {
  const root = TestProject.tmpdir("adapter-source-unit-");
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

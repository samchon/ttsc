import { assertRejectsNonTypeScriptExtensions } from "../../internal/metro-transform-decisions";

/**
 * Verifies the transformer rejects declaration and non-TypeScript extensions.
 *
 * The negative twin of extension acceptance: `.d.ts`/`.d.mts` declarations and
 * `.js`/`.jsx`/`.json`/`.css` files carry no transformable TypeScript and must
 * pass straight through to the upstream transformer.
 *
 * 1. For each declaration / non-TypeScript extension, call `shouldTransform`.
 * 2. Assert it returns false for all of them.
 *
 * @evidence contracts/testing.md#behavioral-verification shouldTransform returns false with default options for fourteen paths: .d.ts, .d.mts, .d.cts, .d.css.ts, .js, .jsx, .mjs, .cjs, .mtsx, .ctsx, .json, .css, a node_modules/pkg/a.ts path and a NUL-prefixed virtual id.
 * @evidence contracts/testing.md#independent-expectations Each rejected path is authored in the test from the supported-source-target contract; the false expectations are not derived from the predicate's own matcher.
 * @evidence contracts/testing.md#distinguishing-cases Declaration variants, a compound declaration, JavaScript variants, near-miss mtsx/ctsx spellings, data files, a dependency path and a virtual id are all negatives; the positive extensions are asserted in the companion accepts entry, not here.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls shouldTransform from packages/metro/src/transformer.ts directly in-process with plain option objects; it neither resolves an upstream nor starts a compile.
 */
export const test_transformer_rejects_non_typescript_extensions = async () => {
  await assertRejectsNonTypeScriptExtensions();
};

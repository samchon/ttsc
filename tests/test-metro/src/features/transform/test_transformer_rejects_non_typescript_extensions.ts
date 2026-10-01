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
 * @evidence contracts/testing.md#behavioral-verification shouldTransform rejects declarations, JavaScript variants, neighboring mtsx/ctsx spellings, data files, node_modules paths and NUL virtual ids.
 * @evidence contracts/testing.md#independent-expectations The supported source-target contract excludes each explicitly authored negative path rather than deriving the expected boolean from a matcher.
 * @evidence contracts/testing.md#distinguishing-cases The fourteen negative paths retain declaration variants, compound declarations and invalid neighboring extensions, against the four admitted extensions.
 * @evidence contracts/testing.md#execution-ownership This named src/features export executes authored Metro decisions in the source-unit Node process; fixture callbacks supply resolver results and no compiled package, native build, install or host starts.
 */
export const test_transformer_rejects_non_typescript_extensions = async () => {
  await assertRejectsNonTypeScriptExtensions();
};

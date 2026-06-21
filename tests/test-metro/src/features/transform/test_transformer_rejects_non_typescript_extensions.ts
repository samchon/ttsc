import { assertRejectsNonTypeScriptExtensions } from "../../internal/metro-transform";

/**
 * Verifies the transformer rejects declaration and non-TypeScript extensions.
 *
 * The negative twin of extension acceptance: `.d.ts`/`.d.mts` declarations and
 * `.js`/`.jsx`/`.json`/`.css` files carry no transformable TypeScript and must
 * pass straight through to the upstream transformer.
 *
 * 1. For each declaration / non-TypeScript extension, call `shouldTransform`.
 * 2. Assert it returns false for all of them.
 */
export const test_transformer_rejects_non_typescript_extensions = async () => {
  await assertRejectsNonTypeScriptExtensions();
};

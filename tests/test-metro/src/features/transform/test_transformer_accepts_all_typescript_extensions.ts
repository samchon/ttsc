import { assertAcceptsAllTypeScriptExtensions } from "../../internal/metro-transform";

/**
 * Verifies the transformer accepts every TypeScript source extension.
 *
 * The ttsc pass must run on `.ts`, `.tsx`, `.cts`, and `.mts` alike. A filter
 * that only matched `.ts` would silently skip `.tsx` components and
 * `.cts`/`.mts` modules.
 *
 * 1. For each TypeScript extension, call `shouldTransform`.
 * 2. Assert it returns true for all of them.
 */
export const test_transformer_accepts_all_typescript_extensions = async () => {
  await assertAcceptsAllTypeScriptExtensions();
};

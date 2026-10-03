import { assertAcceptsAllTypeScriptExtensions } from "../../internal/metro-transform-decisions";

/**
 * Verifies the transformer accepts every TypeScript source extension.
 *
 * The ttsc pass must run on `.ts`, `.tsx`, `.cts`, and `.mts` alike. A filter
 * that only matched `.ts` would silently skip `.tsx` components and
 * `.cts`/`.mts` modules.
 *
 * 1. For each TypeScript extension, call `shouldTransform`.
 * 2. Assert it returns true for all of them.
 *
 * @evidence contracts/testing.md#behavioral-verification shouldTransform returns true for /p/a.ts, /p/a.tsx, /p/a.cts and /p/a.mts with default (empty include and exclude) options.
 * @evidence contracts/testing.md#independent-expectations The supported TypeScript source extensions are listed literally in the test, so each true expectation does not come from the predicate's own pattern.
 * @evidence contracts/testing.md#distinguishing-cases Four admitted extensions are the positive set; the declaration, virtual id, node_modules and non-TypeScript rejections are asserted in the companion rejects entry, not here.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls shouldTransform from packages/metro/src/transformer.ts directly in-process with plain option objects; it neither resolves an upstream nor starts a compile.
 */
export const test_transformer_accepts_all_typescript_extensions = async () => {
  await assertAcceptsAllTypeScriptExtensions();
};

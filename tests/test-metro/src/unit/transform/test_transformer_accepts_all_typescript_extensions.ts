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
 * @evidence contracts/testing.md#behavioral-verification shouldTransform admits ts,tsx,cts,mts source paths.
 * @evidence contracts/testing.md#independent-expectations The supported TypeScript source extension set supplies independent true expectations for all four literal paths.
 * @evidence contracts/testing.md#distinguishing-cases Four admitted extensions contrast declaration, virtual, dependency and non-TypeScript rejections in the companion case.
 * @evidence contracts/testing.md#execution-ownership This named src/unit export executes authored Metro decisions in the source-unit Node process; fixture callbacks supply resolver results and no compiled package, native build, install or host starts.
 */
export const test_transformer_accepts_all_typescript_extensions = async () => {
  await assertAcceptsAllTypeScriptExtensions();
};

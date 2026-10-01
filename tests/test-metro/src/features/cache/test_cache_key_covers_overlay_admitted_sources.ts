import { assertCacheKeyCoversOverlayAdmittedSources } from "../../internal/metro-cache";

/**
 * Verifies the cache key covers a source the caller's overlay admits.
 *
 * See {@link assertCacheKeyCoversOverlayAdmittedSources}: samchon/ttsc#1316's
 * acceptance criterion, that `getCacheKey` responds to a `.js` file under
 * `compilerOptions: { allowJs: true }` and leaves the key alone without it.
 *
 * 1. Prepare a project with inherited output exclusions and an allowJs overlay.
 * 2. Edit and create JavaScript, create replacement output and old declaration-path sources.
 * 3. Compare every key relationship, then remove the overlay and verify JavaScript is ignored.
 *
 * @evidence contracts/testing.md#behavioral-verification With an allowJs overlay (outDir build, declarationDir types) passed through the worker options, editing src/legacy.js and adding src/arrived.js each change getCacheKey; build/emitted.ts and types/emitted.ts leave it unchanged; creating, editing and removing src/inherited-declarations/late.ts each change it; without the overlay, editing legacy.js and adding ignored.js leave it unchanged.
 * @evidence contracts/testing.md#independent-expectations Expected membership follows from the compiler-options contract: allowJs admits .js and path options replace the inherited outDir/declarationDir exclusions. Each expectation is a literal equal/not-equal on authored files rather than a recomputation of the walk.
 * @evidence contracts/testing.md#distinguishing-cases Positives (.js edit, .js appearance, source under the replaced declarationDir create/edit/delete), negatives (TypeScript under the overlay outDir and declarationDir) and a no-overlay control (.js edit and new .js ignored) all run in this body; the inherited outDir exclusion itself is not exercised.
 * @evidence contracts/testing.md#execution-ownership Unit layer: runs prepareSnapshot and getCacheKey from fresh transformer modules in-process over a temp project with files written by fs; no native compile, consumer install or Metro host.
 */
export const test_cache_key_covers_overlay_admitted_sources = async () => {
  await assertCacheKeyCoversOverlayAdmittedSources();
};

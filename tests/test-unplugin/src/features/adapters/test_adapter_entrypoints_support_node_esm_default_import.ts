import { assertAdapterEntrypointsSupportEsmDefaultImport } from "../../internal/adapter-entrypoints";

/**
 * Verifies adapter entrypoints support Node ESM default import.
 *
 * The package ships dual CJS/ESM output. A missing `.mjs` barrel or a broken
 * `exports` field would cause ESM `import()` to fail or return an object with
 * no `default` export. This pins that every bundler-specific ESM entrypoint
 * resolves to a callable factory via dynamic `import()`.
 *
 * 1. Dynamic-import the ESM build of the root index and assert `default.vite` is a
 *    function.
 * 2. Dynamic-import each per-bundler ESM entrypoint.
 * 3. Assert each resolved `default` export is a function.
 */
export const test_adapter_entrypoints_support_node_esm_default_import =
  async () => {
    await assertAdapterEntrypointsSupportEsmDefaultImport();
  };

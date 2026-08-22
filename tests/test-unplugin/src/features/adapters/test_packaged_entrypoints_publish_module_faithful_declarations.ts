import { assertPackedEntrypointsProvideModuleFaithfulDeclarations } from "../../internal/packaged-host-contract";

/**
 * Verifies package declarations: runtime conditions select the same module
 * kind.
 *
 * Locks the package-wide cause behind #1284. One CJS-classified `.d.ts` graph
 * described both runtime branches, so a NodeNext ESM default import became a
 * module namespace and the documented `ttsc()` call failed with TS2349.
 *
 * 1. Pack and extract `@ttsc/unplugin`, then inspect every public export
 *    condition.
 * 2. Compile NodeNext ESM and CommonJS consumers against the packed artifact.
 * 3. Compile Bundler and legacy Node10 consumers against the same artifact.
 */
export const test_packaged_entrypoints_publish_module_faithful_declarations =
  () => {
    assertPackedEntrypointsProvideModuleFaithfulDeclarations();
  };

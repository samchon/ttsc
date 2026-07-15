import { assertPackedManifestDeclaresTtscHost } from "../../internal/packaged-host-contract";

/**
 * Verifies the published @ttsc/unplugin manifest declares its ttsc host (#679).
 *
 * The adapter imports `ttsc` at runtime but keeps it external in the bundle.
 * With `ttsc` declared only under `devDependencies`, a clean install of
 * `@ttsc/unplugin` succeeded while the first import crashed with `Cannot find
 * module 'ttsc'`. The published dependency contract must represent the required
 * external host so a package manager can install, validate, or warn about it.
 *
 * 1. Pack the package as it would be published (rewriting `workspace:*` to a
 *    concrete version).
 * 2. Assert the packed manifest declares `ttsc` as a required peer dependency with
 *    a concrete, resolvable version spec.
 * 3. Assert `ttsc` stays external — not a bundled runtime dependency copy.
 */
export const test_packaged_manifest_declares_the_external_ttsc_host =
  async () => {
    await assertPackedManifestDeclaresTtscHost();
  };

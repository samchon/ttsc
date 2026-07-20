import { assertTransformUsesFilesystemPathIdentity } from "../../internal/transform-path-identity";

/**
 * Verifies compiler-envelope and bundler paths compare by filesystem identity.
 *
 * Case-insensitive hosts must recover an absolute compiler key when a bundler
 * id changes only case, while a case-sensitive host must keep two real files
 * apart. The test also covers graph reachability, completeness and volatility
 * membership, watch deduplication, external snapshot keys, a query id, a
 * trailing separator, and Windows UNC casing.
 *
 * 1. Run the case-insensitive assertions only when the host reports one path
 *    identity.
 * 2. Run the case-sensitive twin only when two on-disk case variants differ.
 * 3. Assert transformed output, watch inputs, and cache reuse match that host
 *    contract.
 */
export const test_transformttsc_uses_filesystem_path_identity = async () => {
  await assertTransformUsesFilesystemPathIdentity();
};

import { assertUnexportedSubpathReportsNotLoaded } from "../../internal/metro-upstream";

/**
 * Verifies an installed package whose requested subpath is not exported is
 * treated as absence, not as a broken installation.
 *
 * Pins the `ERR_PACKAGE_PATH_NOT_EXPORTED` arm of `isCandidateAbsent` on the
 * real loader: the Expo candidate `@expo/metro-config/babel-transformer` is a
 * package subpath, so under version skew a present-but-non-exporting package
 * must stay non-fatal and let auto-detection fall through, exactly as a wholly
 * absent package does. The boundary twin of the init-failure cases, where the
 * candidate resolves and throws during execution.
 *
 * 1. Point `upstreamTransformer` at a bogus subpath of an installed package.
 * 2. Resolve it through the real loader.
 * 3. Assert the absence message, with no init-failure wrapper and no `cause`.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer("typescript/@@ttsc-metro-absent-subpath@@") through the default require loader, where typescript's exports map rejects the subpath, throws an error matching could-not-load-the-configured-upstream, not matching failed to load or initialize, and carrying no cause.
 * @evidence contracts/testing.md#independent-expectations Node's exports-map resolution of the installed typescript package rejects the authored subpath before any module executes (ERR_PACKAGE_PATH_NOT_EXPORTED), so the expected absence message is determined by Node, not by the resolver under test.
 * @evidence contracts/testing.md#distinguishing-cases Only an installed package with an unexported subpath is run; a wholly absent specifier and a resolvable-then-throwing module are neighboring entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveUpstreamTransformer from packages/metro/src/core/upstream.ts in-process with the real require loader against the workspace's installed typescript package; no compile, install or Metro host is involved.
 */
export const test_upstream_unexported_subpath_stays_non_fatal = async () => {
  await assertUnexportedSubpathReportsNotLoaded();
};

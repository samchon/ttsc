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
 */
export const test_upstream_unexported_subpath_stays_non_fatal = async () => {
  await assertUnexportedSubpathReportsNotLoaded();
};

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
 * @evidence contracts/testing.md#behavioral-verification Resolving an unavailable installed TypeScript subpath reports plain absence with no initialization cause.
 * @evidence contracts/testing.md#independent-expectations Node exports-map resolution rejects the authored absent subpath before module execution; literal absence diagnostics independently identify that branch.
 * @evidence contracts/testing.md#distinguishing-cases Unexported subpath contrasts genuine package absence and successful resolution followed by initialization failure.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_upstream_unexported_subpath_stays_non_fatal = async () => {
  await assertUnexportedSubpathReportsNotLoaded();
};

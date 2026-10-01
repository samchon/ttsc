import { assertMissingTransitiveDependencyReported } from "../../internal/metro-upstream";

/**
 * Verifies a missing transitive dependency of the upstream is reported as that
 * dependency's failure, not as candidate absence.
 *
 * Pins the resolve-then-execute split in `tryRequire`: the candidate itself
 * resolves, so a `MODULE_NOT_FOUND` raised while its body `require`s an absent
 * dependency must surface that dependency, never be misclassified as the
 * candidate being uninstalled. Run through the production loader with a real
 * module on disk whose `require` target does not exist.
 *
 * 1. Point `upstreamTransformer` at a module that requires an absent dependency.
 * 2. Resolve it through the real loader.
 * 3. Assert the diagnostic names the missing dependency, not the "could not load"
 *    absence message.
 *
 * @evidence contracts/testing.md#behavioral-verification A resolvable upstream requiring an absent dependency names that dependency instead of misreporting the upstream candidate as absent.
 * @evidence contracts/testing.md#independent-expectations The fixture independently requires its literal nonexistent transitive specifier; that name must survive the error chain.
 * @evidence contracts/testing.md#distinguishing-cases Resolution success followed by MODULE_NOT_FOUND in module evaluation contrasts failure to resolve the candidate itself.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_upstream_missing_transitive_dependency_reported =
  async () => {
    await assertMissingTransitiveDependencyReported();
  };

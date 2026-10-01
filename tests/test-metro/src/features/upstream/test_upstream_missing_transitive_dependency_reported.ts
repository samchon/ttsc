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
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer with the path of a temp CommonJS file that requires "@@ttsc-metro-absent-transitive-dependency@@" throws an error whose message chain names that dependency and whose message does not match the could-not-load absence message.
 * @evidence contracts/testing.md#independent-expectations The fixture file itself requires the authored nonexistent specifier, so the name that must survive in the error chain is known independently of the resolver.
 * @evidence contracts/testing.md#distinguishing-cases Only a candidate that resolves and then fails with MODULE_NOT_FOUND for another module is run; genuine candidate absence is the neighboring absent-candidate entry.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveUpstreamTransformer from packages/metro/src/core/upstream.ts in-process with the real require loader against one temp .cjs file; no compile, install or Metro host is involved.
 */
export const test_upstream_missing_transitive_dependency_reported =
  async () => {
    await assertMissingTransitiveDependencyReported();
  };

import { assertUnprovenCandidatesKeepOneCompile } from "../../internal/transform-project-cache/assertUnprovenCandidatesKeepOneCompile";

/**
 * Verifies samchon/ttsc#1245: a graph carrying superseding resolution
 * candidates still compiles the project once.
 *
 * A candidate is a spelling strictly ahead of the resolution target that won,
 * so the compiler never selected it and usually never read it: no compile-time
 * proof for it can exist. Requiring one made `projectSnapshotComplete` false
 * for every generation of every project that resolves a dependency through a
 * declaration file, which closed the build-scoped shortcut, the narrow
 * persistent path, and complete-snapshot validation at once. Each refusal
 * evicts the generation, so the next module recompiled the whole project and
 * produced another unprovable generation, forever.
 *
 * 1. Build a six-file project whose envelope stamps three unproven candidates per
 *    module.
 * 2. Run a transform over every module sharing one persistent cache.
 * 3. Assert the plugin ran exactly once, not once per module.
 */
export async function test_transformttsc_caches_one_compile_with_unproven_resolution_candidates(): Promise<void> {
  await assertUnprovenCandidatesKeepOneCompile();
}

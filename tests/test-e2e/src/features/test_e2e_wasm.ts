import { Scenarios } from "../internal/Scenarios";
import { case_wasm_build_stamps_release_metadata } from "./wasm/scenes/case_wasm_build_stamps_release_metadata";
import { case_wasm_built_package_entry_runs_its_public_functions } from "./wasm/scenes/case_wasm_built_package_entry_runs_its_public_functions";

/**
 * Collects the existing WASM JavaScript helper and authored build-script cases.
 *
 * Both scenarios read artifacts of the one workspace build in the same Node
 * lifetime and need no fixture, installation, native build or spawned host
 * beyond the build script's own read-only Git queries. They are independent, so
 * each reaches its own verdict.
 *
 * 1. Run the compiled public-entry scenario.
 * 2. Run the release-stamp scenario.
 * 3. Report every failed scenario by name.
 *
 * @evidence contracts/testing.md#behavioral-verification Both scenarios call real compiled exports or the real build script and assert their results; this entry only orders them and aggregates failures.
 * @evidence contracts/testing.md#independent-expectations Literal filesystem and envelope expectations and the stamp sentinels are stated in the scenarios and are independent of the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Helper JSON/filesystem behavior differs from authored buildStamp/linker-argument shape; neither observes a linked WASM artifact's metadata or running Go engine.
 * @evidence contracts/testing.md#execution-ownership This discoverable parent invokes the two exact exported scenes and collects named failures. Helper direct source owners and same-process GoJS host units have separate selections; GoJS runtime preparation does not make those owning callbacks installed-host E2E.
 * @evidence contracts/e2e.md#necessary-boundary Helper calls are a portable duplicate; the stamp case observes authored script/manifest/Git and flag shape, not linker execution. The operative plan records exact direct-helper ownership and reasoned stamp disposition; no new boot, publication or release scenario is introduced to manufacture a boundary.
 * @evidence contracts/e2e.md#shared-execution Both existing entries share the runner lifetime; the stamp module's actual Git queries remain distinct child calls, not zero process cost. There is no install, native build or WASM boot here and no process/generation reduction is measured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The helper's in-memory instance is local, while stamp reads assume fixed checkout facts and retain the require-cached module. Synchronous Git return is not arbitrary descendant shutdown; module retention and immutable inputs are separate premises.
 * @evidence contracts/e2e.md#preserved-coverage Every existing scene assertion remains selected. Exact direct-helper execution and stamp's reasoned shape-only disposition are recorded separately; this parent does not certify shipped WASM metadata or authorize donor deletion before the applicable gate.
 */
export async function test_e2e_wasm(): Promise<void> {
  await Scenarios.collect("wasm", [
    ["built_package_entry_runs_its_public_functions", case_wasm_built_package_entry_runs_its_public_functions],
    ["build_stamps_release_metadata", case_wasm_build_stamps_release_metadata],
  ]);
}

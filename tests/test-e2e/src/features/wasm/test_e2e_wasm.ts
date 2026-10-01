import { Scenarios } from "../../internal/Scenarios";
import { case_wasm_build_stamps_release_metadata } from "./scenes/case_wasm_build_stamps_release_metadata";
import { case_wasm_built_package_entry_runs_its_public_functions } from "./scenes/case_wasm_built_package_entry_runs_its_public_functions";

/**
 * Verifies the @ttsc/wasm package's built JavaScript entry and release stamp.
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
 * @evidence contracts/testing.md#distinguishing-cases The compiled export assembly and the linker metadata are different defects, each owned by its scenario.
 * @evidence contracts/testing.md#execution-ownership test_e2e_wasm is the discoverable entry; its two scenarios are exported case functions selected by the same Evidence claim, and host semantics remain source and Go units.
 * @evidence contracts/e2e.md#necessary-boundary The built artifact and the Git-reading build script are real connections that source units do not execute; neither claims a running Go WASM engine.
 * @evidence contracts/e2e.md#shared-execution No installation, native build or process is started per scenario; the two former separate entries now run in one function over the same workspace build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both scenarios are read-only over the build output and checkout, allocate no temporary directory and start no child that needs joining beyond the build script's synchronous Git calls.
 * @evidence contracts/e2e.md#preserved-coverage Every assertion of both former entries is retained in its scenario; actual Go WASM host tests remain in the integration batch.
 */
export async function test_e2e_wasm(): Promise<void> {
  await Scenarios.collect("wasm", [
    ["built_package_entry_runs_its_public_functions", case_wasm_built_package_entry_runs_its_public_functions],
    ["build_stamps_release_metadata", case_wasm_build_stamps_release_metadata],
  ]);
}

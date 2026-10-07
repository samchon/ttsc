import cp from "node:child_process";
import path from "node:path";

/**
 * Runs the installed compiler batch with this same consumer store, asserting its process finishes successfully.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Runs the installed compiler batch with this same consumer store, asserting its process finishes successfully.
 * @evidence contracts/testing.md#independent-expectations
 *   The compiler child fixtures author their banner/path/strip outputs, declaration and map expectations and runtime stdout; the child rejects a missing installed platform or an unsuccessful operation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The child batch asserts installed platform identity, bundled SDK, versions, plugin emit/declarations/maps, runtime stdout and realpath lint configuration.
 * @evidence contracts/testing.md#execution-ownership
 *   The installed phase invokes experimental/install/src/index.ts over this packed workspace. The child batch owns its four compiler assertions, while this entry owns child status and shared-store assembly.
 * @evidence contracts/e2e.md#necessary-boundary
 *   A packed compiler launcher must discover its native platform, SDK and plugins; a source unit cannot establish this installed assembly.
 * @evidence contracts/e2e.md#shared-execution
 *   Shares this dependency install with adapters; only the child fixture is separate because its automatic plugin declarations and mutable compiler inputs differ.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   The compiler fixture has its own direct plugin manifest and source tree, remapping native TypeScript without changing the adapter consumer. The child clears system Go selection and completes before this phase returns.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyInstalledCompilerContracts body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_installed_compiler({ workspace, root, experimentRoot, pluginCache , assert }) {
    const environment = {
        ...process.env,
        TTSC_CACHE_DIR: pluginCache,
    };
    // Portable suites select system Go. The shipped compiler and runtime must
    // instead resolve the SDK inside their freshly installed platform package.
    delete environment.TTSC_GO_BINARY;
    const result = cp.spawnSync(process.execPath, [
        ...process.execArgv,
        path.join(root, "experimental", "install", "src", "index.ts"),
        `--consumer=${workspace}`,
    ], {
        cwd: experimentRoot,
        env: environment,
        stdio: "inherit",
        windowsHide: true,
    });
    if (result.error)
        throw result.error;
    assert(result.status === 0, "installed compiler contracts failed");
}

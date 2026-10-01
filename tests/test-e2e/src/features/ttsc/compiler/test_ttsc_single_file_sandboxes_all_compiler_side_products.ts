import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies positional compilation writes only the launcher's final JS target.
 *
 * Project and CLI output options still affect an ordinary project build, but
 * the private single-file compiler must not leak declarations, build info, or
 * bundles before the launcher copies one transformed JavaScript file.
 *
 * @evidence contracts/testing.md#behavioral-verification Positional input emits adjacent input.js while CLI/config bundles, declaration and configured tsbuildinfo paths stay absent.
 * @evidence contracts/testing.md#independent-expectations Single-file contract exposes one final JS target; explicit configured/CLI paths independently identify forbidden side products.
 * @evidence contracts/testing.md#distinguishing-cases Project declaration/declarationDir/incremental/outFile/buildInfo plus CLI outFile override.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_file_sandboxes_all_compiler_side_products is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler filesystem writes and launcher private-output policy must prevent side products escaping the sandbox.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Positional input emits adjacent input.js while CLI/config bundles, declaration and configured tsbuildinfo paths stay absent. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_single_file_sandboxes_all_compiler_side_products =
  (): void => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_single_file_sandboxes_all_compiler_side_products/inputs-1"));
    const cliBundle = path.join(root, "cli-bundle.js");
    const result = spawn(
      ttscBin,
      ["--cwd", root, "--outFile", cliBundle, "src/input.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, "src", "input.js")), true);
    for (const escaped of [
      cliBundle,
      path.join(root, "configured-bundle.js"),
      path.join(root, "types", "input.d.ts"),
      path.join(root, "state", "configured.tsbuildinfo"),
    ]) {
      assert.equal(
        fs.existsSync(escaped),
        false,
        `private compiler leaked ${escaped}\n${result.stdout}${result.stderr}`,
      );
    }
  };

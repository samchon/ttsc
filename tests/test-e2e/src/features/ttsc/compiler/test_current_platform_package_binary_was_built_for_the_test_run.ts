import {
  assert,
  child_process,
  nativeBinary,
  workspaceRoot,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies the current-platform helper executes and returns its version banner.
 *
 * The actual command handshake detects an unavailable or incompatible binary
 * without treating committed file placement or an arbitrary size threshold as
 * compiler behavior.
 *
 * 1. Launch the current-platform native helper with --version.
 * 2. Assert successful exit and the platform-helper version prefix.
 *
 * @evidence contracts/testing.md#behavioral-verification Launches the real platform helper with --version and checks successful exit plus the ttsc platform helper banner.
 * @evidence contracts/testing.md#independent-expectations The platform-helper command contract identifies its version output with the literal prefix, independent of filesystem size or package metadata.
 * @evidence contracts/testing.md#distinguishing-cases The successful version handshake distinguishes an executable compatible helper from missing, failed or wrong-command binaries. Compiler source processing belongs to other boundary entries.
 * @evidence contracts/testing.md#execution-ownership The matching compiler feature export is discovered by TestExecutor and starts the actual native platform helper.
 * @evidence contracts/e2e.md#necessary-boundary Native executable activation and its command protocol cannot be established by a direct JavaScript call or a committed-file existence check.
 * @evidence contracts/e2e.md#shared-execution The suite uses its already built current-platform package; one version process supplies status and banner checks without installing or rebuilding per case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The immutable suite binary is invoked read-only with explicit workspace cwd and a synchronous lifetime; no fixture mutation, retained process or cache reset is introduced.
 * @evidence contracts/e2e.md#preserved-coverage Actual activation, successful exit and banner checks remain. Committed-file existence and an unsupported 5MB size threshold were removed because they measured arrangement rather than supported behavior.
 */
export const test_current_platform_package_binary_was_built_for_the_test_run =
  () => {
    const result = child_process.spawnSync(nativeBinary, ["--version"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^ttsc platform helper /);
  };

import {
  assert,
  child_process,
  fs,
  nativeBinary,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies the current-platform package binary was built before the test run.
 *
 * The platform-specific Go binary must exist and be executable before any e2e
 * test can spawn the compiler. Pins the build-integrity gate: if the binary is
 * absent or oversized, subsequent feature tests would fail with confusing "file
 * not found" errors instead of pointing at the true cause, a missing or
 * malformed build artifact. The binary links the TypeScript-Go compiler for the
 * `compile-roots` command ttsx compiles out-of-project files through, so the
 * bound sits above that compiler's size, not at the metadata-only helper's.
 *
 * 1. Resolve the native binary path for the current OS/arch.
 * 2. Assert the file exists and is under 48 MB.
 * 3. Spawn it with `--version` and assert the version banner matches `ttsc
 *    platform helper`.
 */
export const test_current_platform_package_binary_was_built_for_the_test_run =
  () => {
    assert.equal(fs.existsSync(nativeBinary), true);
    assert.ok(
      fs.statSync(nativeBinary).size < 48 * 1024 * 1024,
      "platform helper should stay below 48MB",
    );

    const result = child_process.spawnSync(nativeBinary, ["--version"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^ttsc platform helper /);
  };

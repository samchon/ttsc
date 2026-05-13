import {
  assert,
  child_process,
  fs,
  nativeBinary,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies current platform package binary was built for the test run.
 *
 * This ttsc compiler toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_current_platform_package_binary_was_built_for_the_test_run =
  () => {
    assert.equal(fs.existsSync(nativeBinary), true);
    assert.ok(
      fs.statSync(nativeBinary).size < 5 * 1024 * 1024,
      "platform helper should stay below 5MB",
    );

    const result = child_process.spawnSync(nativeBinary, ["--version"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^ttsc platform helper /);
  };

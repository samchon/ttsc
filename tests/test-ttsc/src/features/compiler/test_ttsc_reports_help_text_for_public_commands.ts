import {
  assert,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies ttsc reports public command help without touching a project.
 *
 * This ttsc compiler toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Execute the built ttsc launcher with `--help`.
 * 2. Assert that the command exits successfully.
 * 3. Assert that the advertised commands include the build, prepare, and clean
 *    front doors users rely on for the standalone host.
 */
export const test_ttsc_reports_help_text_for_public_commands = () => {
  const result = spawn(ttscBin, ["--help"], { cwd: workspaceRoot });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /standalone compiler adapter and plugin host/);
  assert.match(result.stdout, /ttsc prepare \[options\]/);
  assert.match(result.stdout, /ttsc clean \[options\]/);
  assert.match(result.stdout, /Plugin contract:/);
  assert.match(
    result.stdout,
    /Incompatible with --watch, --emit, single-file mode\./,
  );
};

import {
  assert,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies ttsc reports the complete public command help text.
 *
 * The `--help` output is the user-facing contract for every supported
 * sub-command. Pins the presence of the four main commands (`prepare`, `clean`,
 * `fix`, `format`) and the plugin-contract section so documentation drift or
 * accidental command removal is caught before a release.
 *
 * 1. Run the real `ttsc` launcher with `--help` from the workspace root.
 * 2. Assert exit 0 and the tagline on stdout.
 * 3. Assert each public command name and the `Plugin contract:` section appear.
 */
export const test_ttsc_reports_help_text_for_public_commands = () => {
  const result = spawn(ttscBin, ["--help"], { cwd: workspaceRoot });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /standalone compiler adapter and plugin host/);
  assert.match(result.stdout, /ttsc prepare \[options\]/);
  assert.match(result.stdout, /ttsc clean \[options\]/);
  assert.match(result.stdout, /ttsc fix \[options\]/);
  assert.match(result.stdout, /ttsc format \[options\]/);
  assert.match(result.stdout, /Plugin contract:/);
};

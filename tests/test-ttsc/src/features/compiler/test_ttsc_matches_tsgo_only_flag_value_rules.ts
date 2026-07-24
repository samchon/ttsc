import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies tsgo remains authoritative for syntax of forwarded compiler flags.
 *
 * Launcher-owned options accept inline `=VALUE`, but pinned tsgo does not.
 * `composite` is also tsconfig-only and can only be disabled or cleared from
 * the command line.
 */
export const test_ttsc_matches_tsgo_only_flag_value_rules = (): void => {
  const root = TestProject.commonJsProject({
    "src/main.ts": "export const value = 1;\n",
  });

  const inline = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--outFile=dist/bundle.js", "--cwd", root],
    { cwd: root },
  );
  assert.notEqual(inline.status, 0);
  assert.match(
    `${inline.stdout}${inline.stderr}`,
    /Unknown compiler option '--outFile=dist\/bundle\.js'/i,
  );

  const enabled = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--composite", "--cwd", root],
    { cwd: root },
  );
  assert.notEqual(enabled.status, 0);
  assert.match(
    `${enabled.stdout}${enabled.stderr}`,
    /composite.*only be specified in ['"]tsconfig\.json/i,
  );

  const disabled = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--composite", "false", "--noEmit", "--cwd", root],
    { cwd: root },
  );
  assert.equal(disabled.status, 0, disabled.stderr);
};

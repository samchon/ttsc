import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx reports front-door help, version, and entry errors directly.
 *
 * This ttsx runtime toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Execute the built ttsx launcher without creating a project fixture.
 * 2. Assert help and version are handled before project discovery.
 * 3. Assert a missing entry produces a stable runner diagnostic.
 */
export const test_ttsx_reports_frontdoor_help_version_and_entry_errors = () => {
  const help = TestProject.spawn(TestProject.TTSX_BIN, ["--help"], {
    cwd: TestProject.WORKSPACE_ROOT,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /TypeScript runner provided by ttsc\./);
  assert.match(help.stdout, /ttsx \[options\] <entry\.ts>/);

  const version = TestProject.spawn(TestProject.TTSX_BIN, ["--version"], {
    cwd: TestProject.WORKSPACE_ROOT,
  });
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^ttsx /);
  assert.match(version.stdout, /\(Version [^)]+\)/);

  const missingEntry = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["missing-entry.ts"],
    {
      cwd: TestProject.WORKSPACE_ROOT,
    },
  );
  assert.equal(missingEntry.status, 2);
  assert.match(missingEntry.stderr, /ttsx: entry not found:/);
  assert.match(missingEntry.stderr, /missing-entry\.ts/);
};

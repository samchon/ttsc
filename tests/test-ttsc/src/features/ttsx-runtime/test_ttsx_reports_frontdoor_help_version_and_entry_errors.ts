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
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public CLI invocations print help/version and reject an absent entry with exact exit and diagnostic assertions.
 * @evidence contracts/testing.md#independent-expectations The documented CLI usage grammar, ttsx version prefix/native compiler version payload and explicit missing entry filename define independent output expectations.
 * @evidence contracts/testing.md#distinguishing-cases Help and version succeed before project preparation; a nonexistent entry fails with status 2 and names the requested file rather than producing a compiler diagnostic.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns three terminal/error bootstrap invocations with no consumer installation or project build; argument spelling matrices belong to the parser unit.
 * @evidence contracts/e2e.md#necessary-boundary Real CLI bootstrap connects terminal requests to renderers, native compiler version discovery and filesystem entry rejection; parsing return values alone cannot prove these outputs.
 * @evidence contracts/e2e.md#shared-execution No project or compiler preparation repeats here. Different public terminal/error command requests require independent CLI argv lifetimes; each process does only its requested bootstrap operation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity These stateless invocations use the workspace as cwd and create no fixture or emit; every synchronous child completes before the next operation, with no retained state shared across requests.
 * @evidence contracts/e2e.md#preserved-coverage All original help usage/headline, version/compiler-version, missing-entry filename/status assertions remain; portable terminal precedence and lexical spellings are independently owned by the parser unit.
 */
export function test_ttsx_reports_frontdoor_help_version_and_entry_errors() {
  const help = TestProject.spawn(TestProject.TTSX_BIN, ["--help"], {
    cwd: TestProject.WORKSPACE_ROOT,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /TypeScript runner provided by ttsc\./);
  assert.match(help.stdout, /ttsx \[options\] <entry> \[argv\.\.\.\]/);

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
}
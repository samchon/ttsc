import { TestProject } from "@ttsc/testing";

import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc cache paths` resolves every supported flag through the shared
 * schema identity.
 *
 * `cache paths` used to compare raw flag text even though the main launcher
 * normalizes every schema-owned spelling. A CI script with `--JSON`, `--Cwd`,
 * or `-P` therefore failed only on this subcommand. This drives the real
 * launcher so canonical and case-variant spellings reach the same cache path
 * calculation while the command keeps its strict value, command-scope, and
 * unknown-option boundaries.
 *
 * 1. Create a project and compare canonical cache options with case variants and
 *    `-P`.
 * 2. Assert that every supported spelling returns the same JSON path record.
 * 3. Assert `--json` values, non-cache schema flags, and unknown options still
 *    fail at the cache command boundary.
 *
 * @evidence contracts/testing.md#behavioral-verification Canonical cache-path flags and case variants must return identical JSON records; -P must identify the consumer root. Attached/spaced JSON values, unsupported --binary and an unknown cache option must each exit nonzero with their specific cache-command messages.
 * @evidence contracts/testing.md#independent-expectations Case variants follow schema identity while literal projectRoot anchors the -P path independently. Canonical-versus-variant equality alone could share a wrong record; the separate cache-roots entry pins its fields. Literal failure texts specify strict cache command boundaries.
 * @evidence contracts/testing.md#distinguishing-cases Canonical/case-normalized spellings and uppercase short project alias are accepted; attached boolean value, separated extra command token, known-but-out-of-scope schema flag and unknown flag are distinct rejection cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_cache_paths_resolves_schema_flag_spellings in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by TestSourceUnits.
 * @evidence contracts/e2e.md#necessary-boundary Actual launcher cache-command dispatch and strict public diagnostics must agree with the shared schema. Pure parser tests cannot establish the subcommand's JSON execution and rejection scope.
 * @evidence contracts/e2e.md#shared-execution One immutable consumer and built launcher serve seven sequential exited children. Distinct argument vectors need separate CLI dispatch to test their public error surface, while parsing semantics remain portable unit responsibilities. No native compiler/build preparation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_cache_paths_resolves_schema_flag_spellings. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_cache_paths_resolves_schema_flag_spellings = () => {
  const root = TestProject.physicalPath(
    createProject({
      "src/main.ts": "export const value = 1;\n",
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
    }),
  );
  const canonical = spawn(
    ttscBin,
    ["cache", "paths", "--json", "--cwd", root, "--cache-dir", ".cache"],
    { cwd: root },
  );
  assert.equal(canonical.status, 0, canonical.stderr);

  const caseVariants = spawn(
    ttscBin,
    ["cache", "paths", "--JSON", "--Cwd", root, "--CACHE-DIR", ".cache"],
    { cwd: root },
  );
  assert.equal(caseVariants.status, 0, caseVariants.stderr);
  assert.deepEqual(
    JSON.parse(caseVariants.stdout),
    JSON.parse(canonical.stdout),
  );

  const projectAlias = spawn(
    ttscBin,
    ["cache", "paths", "--JSON", "--CWD", root, "-P", "tsconfig.json"],
    { cwd: root },
  );
  assert.equal(projectAlias.status, 0, projectAlias.stderr);
  assert.equal(JSON.parse(projectAlias.stdout).projectRoot, root);

  const jsonValue = spawn(ttscBin, ["cache", "paths", "--json=true"], {
    cwd: root,
  });
  assert.notEqual(jsonValue.status, 0);
  assert.match(jsonValue.stderr, /--json does not take a value/);

  const spacedJsonValue = spawn(
    ttscBin,
    ["cache", "paths", "--json", "false"],
    { cwd: root },
  );
  assert.notEqual(spacedJsonValue.status, 0);
  assert.match(spacedJsonValue.stderr, /cache paths does not support "false"/);

  const unsupportedSchemaFlag = spawn(
    ttscBin,
    ["cache", "paths", "--binary", "tsgo"],
    { cwd: root },
  );
  assert.notEqual(unsupportedSchemaFlag.status, 0);
  assert.match(
    unsupportedSchemaFlag.stderr,
    /cache paths does not support "--binary"/,
  );

  const unknown = spawn(
    ttscBin,
    ["cache", "paths", "--not-a-real-cache-option"],
    { cwd: root },
  );
  assert.notEqual(unknown.status, 0);
  assert.match(
    unknown.stderr,
    /cache paths does not support "--not-a-real-cache-option"/,
  );
};

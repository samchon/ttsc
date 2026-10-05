import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies ttsx still fails at the compile gate on a type error inside an
 * imported workspace package.
 *
 * The runtime hooks are deliberately runtime-only: they must not weaken the
 * up-front type-check. ttsx's tsgo build deep-checks the whole program,
 * including workspace neighbours reached through imports, so a type error in a
 * symlinked workspace dependency must abort before the entry ever runs.
 *
 * 1. Create an ESM project plus a symlinked `ws-dep` whose source contains a type
 *    error, imported by the entry.
 * 2. Run ttsx against the entry.
 * 3. Assert it exits non-zero, names the dependency file, and prints no output.
 *
 * @evidence contracts/testing.md#behavioral-verification One real compiler gate reports both an imported symlinked workspace type error and a consumer number-to-string type error; nonzero status, named dependency, project-check diagnostic, empty stdout, absent side-effect marker and empty runtime project output pin failure before execution.
 * @evidence contracts/testing.md#independent-expectations Literal incompatible string/number assignments violate TypeScript strict typing independently of the compiler's diagnostics; a failing preparation must not execute marker writes or retain its run output.
 * @evidence contracts/testing.md#distinguishing-cases The same program has errors in both the consumer and symlinked workspace, so reporting one cannot hide failure to check the other; malformed config, excluded entry strict checking and successful emit are separate boundaries.
 * @evidence contracts/testing.md#execution-ownership The matching named E2E entry runs the actual built launcher and native compiler once against a symlinked authored fixture; no native compiler or host is moved into the source unit population.
 * @evidence contracts/e2e.md#necessary-boundary Native compiler traversal across a physical workspace link and launcher diagnostic/cleanup channels must work together; option or project-selection unit results cannot prove that check-before-execution connection.
 * @evidence contracts/e2e.md#shared-execution Former consumer-only failure checks now join the existing workspace failure program, sharing one native compiler preparation and launcher instead of a separate failing project host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The isolated symlink target and explicit runtime cache contain no prebuilt output; marker starts absent, synchronous spawn finishes failure cleanup before assertions and TestProject owns the fixture.
 * @evidence contracts/e2e.md#preserved-coverage Original workspace nonzero, dependency-file and empty-stdout assertions remain; all former consumer-only nonzero, project-check failed, number-to-string diagnostic, no program output/marker and existing-empty project-cache assertions execute here.
 */
export function test_ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package() {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package/inputs-1",
    ),
  );
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  fs.symlinkSync(
    path.join(root, "packages", "ws-dep"),
    path.join(root, "node_modules", "ws-dep"),
    "junction",
  );

  const marker = path.join(root, "type-error-marker.txt");
  const cacheDir = path.join(root, ".ttsx-cache");
  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
    { cwd: root, env: { TTSX_MARKER: marker } },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ws-dep[\\/]src[\\/]index\.ts/);
  assert.equal(result.stdout.trim(), "");
  assert.match(result.stderr, /project check failed/);
  assert.match(
    result.stderr,
    /Type 'number' is not assignable to type 'string'/,
  );
  assert.match(
    result.stderr,
    /Type 'string' is not assignable to type 'number'/,
  );
  assert.doesNotMatch(result.stdout, /should-not-run/);
  assert.equal(fs.existsSync(marker), false);
  const projectCache = path.join(cacheDir, "project");
  assert.equal(fs.existsSync(projectCache), true);
  assert.deepEqual(fs.readdirSync(projectCache), []);
}

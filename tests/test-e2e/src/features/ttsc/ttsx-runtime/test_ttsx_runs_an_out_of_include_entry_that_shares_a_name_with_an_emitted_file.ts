import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TTSX_REGISTER, linkTtscPackage } from "../../../internal/ttsc/internal/ttsx-register";

/**
 * Verifies ttsx runs an out-of-`include` entry that shares its name with a file
 * the project build emitted, in a project that declares no `rootDir`.
 *
 * Pins samchon/ttsc#1382 rows 3 and 4. With no `rootDir`, the project's own
 * directory is the source root, so `scripts/index.ts` sits inside it although
 * `include` names only `src`. The entry gate asked only whether the entry was
 * under that root, then let the lookup score `src/index.js` by its shared
 * `index` name, and ttsx ran the wrong program with exit status 0 — the
 * out-of-`include` lane (#1070) that compiles such an entry never ran. The
 * existing out-of-`include` case declares `rootDir: "src"`, which is exactly
 * the layout that hid this.
 *
 * 1. Create a project with `include: ["src"]`, no `rootDir`, and both
 *    `src/index.ts` and `scripts/index.ts`.
 * 2. Run `scripts/index.ts` through ttsx and through the `ttsc/register` preload,
 *    then run `src/index.ts` through ttsx.
 * 3. Assert each run prints its own file's marker.
 * @evidence contracts/testing.md#behavioral-verification Runs excluded scripts/index through ttsx and public register, then included src/index through ttsx, requiring script, script and source markers.
 * @evidence contracts/testing.md#independent-expectations Distinct authored values for the two index files independently detect reuse of the wrong same-named emit.
 * @evidence contracts/testing.md#distinguishing-cases Both excluded launch routes and an included positive control must keep their source identities; extra-output cleanup is not inspected.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_an_out_of_include_entry_that_shares_a_name_with_an_emitted_file at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Three real Node/native hosts connect included and excluded source ownership to both public runtime launch routes.
 * @evidence contracts/e2e.md#shared-execution One linked consumer project and installed compiler serve all three hosts, sharing immutable fixtures rather than duplicating installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Source/config identities stay fixed between synchronous hosts; package links and temporary project are retained until harness process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All three exact marker assertions remain here, without claiming unseen cache-release or output-cleanup behavior.
 */
export function test_ttsx_runs_an_out_of_include_entry_that_shares_a_name_with_an_emitted_file() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_runs_an_out_of_include_entry_that_shares_a_name_with_an_emitted_file/inputs-1"));
    linkTtscPackage(root);

    const script = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "scripts/index.ts"],
      { cwd: root },
    );
    assert.equal(script.status, 0, script.stderr);
    assert.equal(script.stdout.trim(), "ran scripts/index.ts");

    const registered = TestProject.spawn(
      process.execPath,
      ["--require", TTSX_REGISTER, "scripts/index.ts"],
      { cwd: root },
    );
    assert.equal(registered.status, 0, registered.stderr);
    assert.equal(registered.stdout.trim(), "ran scripts/index.ts");

    const source = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/index.ts"],
      { cwd: root },
    );
    assert.equal(source.status, 0, source.stderr);
    assert.equal(source.stdout.trim(), "ran src/index.ts");
  }

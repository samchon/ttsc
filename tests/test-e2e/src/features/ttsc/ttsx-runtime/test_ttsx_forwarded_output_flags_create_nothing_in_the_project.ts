import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Verifies compiler flags that name output locations, forwarded before the
 * entry, never move ttsx's private build into the project.
 *
 * Pins samchon/ttsc#1404. A flag before the entry reaches the compiler after
 * the private `--outDir` ttsx injected, so `ttsx --outDir distx main.ts` wrote
 * the whole emit into `distx/` and ran only because a name match found it
 * there. Output-location flags may still shape the check, but every build ttsx
 * starts now puts all of its output in the run's own directory.
 *
 * 1. Create a project with `rootDir: "src"` and `outDir: "lib"`.
 * 2. Run the entry once per forwarded flag set: `--outDir`, `--declaration
 *    --declarationDir`, `--incremental --tsBuildInfoFile`, and `--outFile`.
 * 3. Assert each run prints the entry's output and leaves the project's file list
 *    unchanged.
 * @evidence contracts/testing.md#behavioral-verification Runs outDir, declarationDir, build-info and outFile variants and checks success, ran output and unchanged top-level project names.
 * @evidence contracts/testing.md#independent-expectations The baseline directory-name list and authored ran marker are independent observations; they do not inspect bytes or descendants of existing directories.
 * @evidence contracts/testing.md#distinguishing-cases Four flag families exercise output isolation, but each comparison only observes top-level names and the loop fails before later variants on a failure.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_forwarded_output_flags_create_nothing_in_the_project at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Real forwarded native emission and runtime output isolation are observed through four ttsx hosts, beyond argument parsing.
 * @evidence contracts/e2e.md#shared-execution All four variants share one immutable source project and toolchain; each still creates a fresh runtime host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each synchronous child finishes before the next comparison; the tracked project is reclaimed at process exit, and nested writes are outside this oracle.
 * @evidence contracts/e2e.md#preserved-coverage All four status, marker and top-level equality assertions remain here; no recursive no-write guarantee is claimed.
 */
export function test_ttsx_forwarded_output_flags_create_nothing_in_the_project() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_forwarded_output_flags_create_nothing_in_the_project/inputs-1"));
    const before = listProject(root);

    for (const flags of [
      ["--outDir", "distx"],
      ["--declaration", "--declarationDir", "typesx"],
      ["--incremental", "--tsBuildInfoFile", "state/run.tsbuildinfo"],
      ["--outFile", "bundle.js"],
    ]) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...flags, "src/main.ts"],
        { cwd: root },
      );
      const label = flags.join(" ");
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), "ran", label);
      assert.deepEqual(
        listProject(root),
        before,
        `${label} wrote into the project`,
      );
    }
  }

/** Top-level entries of the project, minus `node_modules`. */
function listProject(root: string): string[] {
  return fs
    .readdirSync(root)
    .filter((name) => name !== "node_modules")
    .sort();
}

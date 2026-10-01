import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx compiles an installed package's root without creating anything
 * in the package's directory, even transiently.
 *
 * A root no build covered is compiled through a tsconfig ttsx synthesizes to
 * inherit the owning project's options. For an installed package that build is
 * emit-only and runs while the program is running, so its tsconfig lives in
 * ttsx's private directory: a package directory may be read-only, and a file
 * created and removed there still changes the directory's metadata, which is
 * how a plugin descriptor's missing resolution candidates are fingerprinted.
 * The directory's modification time records any entry that came and went.
 *
 * 1. Install a package whose `main` is a root its own `include` omits.
 * 2. Record the package directory's modification time and entries.
 * 3. Run a consumer entry that requires the package.
 * 4. Assert the program ran and the directory is exactly as it was.
 * @evidence contracts/testing.md#behavioral-verification Ttsx executes installed root-pkg/index.ts omitted by its own include, prints root-ran, and leaves the package directory sorted entry names and mtimeNs equal to the pre-run snapshot.
 * @evidence contracts/testing.md#independent-expectations The authored value is independent of compiler output. Native filesystem mtime plus entry names detect additions/removals at the package directory, including temporary config entries under normal timestamp resolution.
 * @evidence contracts/testing.md#distinguishing-cases The package main lies outside src while an included sibling establishes an owning project. The snapshot does not hash existing contents or observe descendant directory metadata.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_compiles_an_installed_package_root_without_writing_into_the_package entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Actual emit-only fallback must execute package source without writing its synthesized config into the package root. Direct target-location planning cannot establish observed directory immutability.
 * @evidence contracts/e2e.md#shared-execution One consumer/package graph and one host retain both dependency program and omitted-root preparation. No project is reinstalled or recreated per assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The baseline is captured before the host starts and compared after it exits. TestProject owns the fixture; directory mtime resolution and hard termination limit transient-write/cleanup observations.
 * @evidence contracts/e2e.md#preserved-coverage Original success, root-ran value and whole root-directory snapshot equality remain. The assertion scope is directory entries/mtime, not every package byte.
 */
export function test_ttsx_compiles_an_installed_package_root_without_writing_into_the_package() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_compiles_an_installed_package_root_without_writing_into_the_package/inputs-1"));
    const pkg = path.join(root, "node_modules", "root-pkg");
    const before = snapshot(pkg);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "root-ran");
    assert.deepEqual(snapshot(pkg), before);
  }

/** The directory's modification time and its sorted entry names. */
function snapshot(directory: string): { entries: string[]; mtimeNs: bigint } {
  return {
    entries: fs.readdirSync(directory).sort(),
    mtimeNs: fs.statSync(directory, { bigint: true }).mtimeNs,
  };
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a `rootDir` that is a symlinked directory still selects the whole
 * project, not the entry-only fallback.
 *
 * `rootDir` is joined against the project root and compared against the entry,
 * and the entry is resolved physically. Leaving the join unresolved makes the
 * two sides different spellings of the same directory, so `path.relative`
 * answers `../sources/main.ts` and the ownership gate reads an ordinary
 * in-project entry as outside its own root.
 *
 * The fallback that follows is what makes this observable rather than merely
 * wasteful: it compiles a project declaring only the entry, so a file the real
 * project supplies — here an ambient `.d.ts` — is no longer in the program and
 * the run dies with a type error the whole-project build never sees.
 *
 * 1. Point `rootDir` at `src`, a symlink to the real `sources` directory.
 * 2. Have the entry name a type only an ambient `.d.ts` in that directory
 *    declares.
 * 3. Run ttsx and assert it compiled and ran under the real project.
 * @evidence contracts/testing.md#behavioral-verification Runs src/main through a junction to sources and requires success, the runtime marker and absence of a missing BUILD_TAG diagnostic.
 * @evidence contracts/testing.md#independent-expectations The authored ambient declaration and main marker independently require the compiler to include the project declaration population.
 * @evidence contracts/testing.md#distinguishing-cases The symlinked root must retain ambient membership; inability to create the link returns without exercising this boundary.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_compiles_the_whole_project_when_rootdir_is_a_symlink at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual native project compilation and Node execution through a filesystem alias distinguish loss of declaration membership.
 * @evidence contracts/e2e.md#shared-execution One project and one ttsx host exercise the alias; shared installed toolchain preparation does not require a source-plugin producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The alias and its target belong to the tracked project; the child completes synchronously and process-exit cleanup owns the fixture.
 * @evidence contracts/e2e.md#preserved-coverage The runtime and ambient-diagnostic assertions remain here; the early return is a coverage limitation, not proof for unsupported link creation.
 */
export function test_ttsx_compiles_the_whole_project_when_rootdir_is_a_symlink() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "symlinked-rootdir",
        version: "1.0.0",
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "lib",
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      // The ambient declaration lives beside the entry, so only a build that
      // keeps the project's file set can see it.
      "sources/globals.d.ts": `declare const BUILD_TAG: string;\n`,
      // `typeof BUILD_TAG` is a type position, so the ambient declaration is
      // needed to compile while nothing references it at run time.
      "sources/main.ts": [
        `const tag: typeof BUILD_TAG = "ran-under-the-project";`,
        `console.log(tag);`,
        "",
      ].join("\n"),
    });
    try {
      fs.symlinkSync(
        path.join(root, "sources"),
        path.join(root, "src"),
        "junction",
      );
    } catch {
      // Without symlink permission the two spellings never diverge, and the
      // contract this pins cannot be exercised.
      return;
    }
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ran-under-the-project/);
    assert.doesNotMatch(
      result.stderr,
      /Cannot find name 'BUILD_TAG'/,
      "the entry-only fallback lost the project's ambient declaration",
    );
  }

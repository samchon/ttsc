import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx resolves an installed package root's `${configDir}` path
 * mapping from the package's own tsconfig directory.
 *
 * An emit-only root build writes its synthesized tsconfig into ttsx's private
 * directory, which is sound only while nothing it emits depends on where that
 * tsconfig sits. `${configDir}` is the exception: tsgo substitutes the
 * directory of the config it was given, and inside `paths` that decides which
 * module an import resolves to. Here it decides whether `export { Shape }` is a
 * type-only re-export the emit drops, or a runtime import of a specifier Node
 * cannot resolve. A chain that uses `${configDir}` therefore keeps the
 * synthesized tsconfig beside the real one.
 *
 * 1. Install a package whose tsconfig maps `@shapes/*` through `${configDir}`,
 *    with a `main` outside its `include` that re-exports a type through the
 *    mapping.
 * 2. Run a consumer entry that requires the package, so the consumer's own check
 *    never compiles the package's source under the consumer's config.
 * 3. Assert the program ran, which needs the re-export elided.
 * @evidence contracts/testing.md#behavioral-verification Loads an installed package root outside its include using ${configDir} paths for a type-only reexport and requires area-9.
 * @evidence contracts/testing.md#independent-expectations The authored package value and interface-only dependency determine output independently of the generated config path.
 * @evidence contracts/testing.md#distinguishing-cases The excluded package root must inherit config-relative resolution; emitted text and transient package writes are not inspected.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_resolves_config_dir_paths_for_an_installed_package_root at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Real native package fallback compilation and Node loading connect ${configDir} substitution to type erasure and execution.
 * @evidence contracts/e2e.md#shared-execution One host shares the consumer graph, package fixture and compiler; no repeated consumer installation or native plugin producer is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The package config and shapes stay immutable during compilation; the tracked project owns their lifetime until process exit.
 * @evidence contracts/e2e.md#preserved-coverage The exact area-9 assertion remains here without claiming a byte-level emit or package-immutability oracle.
 */
export function test_ttsx_resolves_config_dir_paths_for_an_installed_package_root() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_resolves_config_dir_paths_for_an_installed_package_root/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "area-9");
  }

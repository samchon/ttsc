import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx builds a source-shipping dependency's whole project when the
 * dependency's config sets `noEmitOnError` and a file the consumer never
 * imports has a type error.
 *
 * The dependency lane is emit-only: the consumer never type-checks a package it
 * installed, so a diagnostic must not withhold the emit. Honoured, an inherited
 * `noEmitOnError: true` turns the package's own diagnostic into an empty build,
 * and every file the program reaches is then compiled again as a root of its
 * own, one compiler run per file. Only the whole-project build writes the file
 * nothing imports, so its JavaScript in the run's dependency cache, which the
 * runtime manifest names and the launcher removes on exit, is the proof that
 * the project build ran. The program still runs on the type-aware emit a
 * `type`+`namespace` merge needs.
 *
 * 1. Install an ESM package with `noEmitOnError: true`, a type error in a file
 *    nothing imports, and a `type`+`namespace` merge imported for its type
 *    only.
 * 2. Run a consumer entry that calls the package, then looks for the unimported
 *    file's JavaScript in the dependency cache.
 * 3. Assert the package executed and the JavaScript was there.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx imports strict-dep and must print wrapped-7 project-built=true despite an unimported dependency type error and noEmitOnError:true.
 * @evidence contracts/testing.md#independent-expectations The authored wrap result is 7; unused.js cannot exist from merely lowering imported index/brand roots, so runtime inspection of the dependency cache distinguishes a whole-project emit.
 * @evidence contracts/testing.md#distinguishing-cases Dependency-only errors must not gate emission, and a type/namespace merge still needs type-aware output. The unimported file is the positive whole-project witness; own-source failure gates are complementary cases.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_builds_a_dependency_whose_config_sets_no_emit_on_error entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary The real dependency compiler, run manifest and Node import must agree on a successful emit-only generation. Direct policy calculations cannot prove that unimported output reached the live run cache.
 * @evidence contracts/e2e.md#shared-execution One immutable consumer/package graph uses one ttsx host. Consumer and dependency have different owning compiler inputs; the dependency program covers all its files instead of a separate host per imported source.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The entry inspects the dependency cache while its manifest is live. TestProject owns the fixture, and the runtime owns generation release at host exit; this case does not itself assert cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original status zero and exact wrapped value/cache witness remain here. No whole-project build count or cleanup assertion is inferred from the filename.
 */
export function test_ttsx_builds_a_dependency_whose_config_sets_no_emit_on_error() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_builds_a_dependency_whose_config_sets_no_emit_on_error/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "wrapped-7 project-built=true");
  }

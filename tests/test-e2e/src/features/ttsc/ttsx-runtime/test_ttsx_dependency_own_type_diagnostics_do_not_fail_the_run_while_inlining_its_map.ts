import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import {
  physicalRealpath,
  runTtsxWithCoverage,
  sourceMapSourcePath,
} from "../../../internal/ttsc/internal/ttsx-source-map";

/**
 * Verifies a dependency's OWN type diagnostics never fail a ttsx run, even
 * while ttsx builds that dependency to obtain a source map to inline (issue
 * #353).
 *
 * A source-shipping dependency is built under its own (possibly stricter)
 * tsconfig for type-aware emit, but its diagnostics belong to that package, not
 * the user's program — the dependency build runs emit-only
 * (`skipDiagnosticsCheck`). This pins that a dependency whose config would trip
 * `noUnusedLocals`/`noUnusedParameters` still emits, runs, and yields an
 * inlined map, so the map work added for #353 cannot start gating on foreign
 * diagnostics.
 *
 * 1. Install a `built-dep` whose tsconfig sets `noUnusedLocals` /
 *    `noUnusedParameters` and whose source carries an unused local and
 *    parameter (a real TS6133 under that config).
 * 2. Run an entry that imports and calls it under `NODE_V8_COVERAGE`.
 * 3. Assert exit 0, the dependency executed, and its map `data` inlined with the
 *    real source path.
 * @evidence contracts/testing.md#behavioral-verification A coverage-recorded ttsx run imports built-dep despite its noUnusedLocals/noUnusedParameters inputs; status zero, a served index.ts script, nonnull map and exact physical source path must result.
 * @evidence contracts/testing.md#independent-expectations Unused fixture local/parameter are deliberate foreign diagnostics, and the native realpath of authored index.ts is the map oracle. V8 supplies the served-script/map record independently of the launcher.
 * @evidence contracts/testing.md#distinguishing-cases Foreign diagnostics must not block source-map-bearing emit. The assertion checks V8 script/map presence, but does not assert greet stdout or its function execution count.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Emit-only compilation, runtime serving and Node V8 map ingestion must connect to the real dependency source. Direct inline-map units cannot establish that V8 received the map during successful execution.
 * @evidence contracts/e2e.md#shared-execution One consumer/package project and one coverage host are prepared. The helper creates a fresh coverage directory and reads its records after host exit; no per-map fixture/compiler install occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks consumer and coverage directories. Windows path comparisons explicitly case-fold while the physical path oracle permits platform aliases; the synchronous host ends before coverage parsing.
 * @evidence contracts/e2e.md#preserved-coverage All original success, script presence, nonnull map and exact canonical-source assertions remain. The older prose that dependency executed is bounded by these actual observations rather than a missing greet-value assertion.
 */
export function test_ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map/inputs-1"));

    const run = runTtsxWithCoverage(root, "src/main.ts");
    assert.equal(
      run.status,
      0,
      `a dependency's own type diagnostics must not fail the run\n${run.stderr}`,
    );

    const script = run.scriptEndingWith("index.ts");
    assert.ok(script, "coverage must record the served dependency script");
    assert.ok(
      script.sourceMap !== null,
      "the dependency's map must still inline (data present)",
    );
    const mapped = sourceMapSourcePath(script);
    const real = physicalRealpath(
      path.join(root, "node_modules", "built-dep", "src", "index.ts"),
    );
    assert.ok(mapped, "the inlined map must list a source path");
    assert.equal(
      caseFold(path.normalize(mapped)),
      caseFold(real),
      "the map's source must be the dependency's real absolute index.ts",
    );
  }

function caseFold(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

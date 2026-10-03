import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";

/**
 * Verifies ttsx builds a raw `.ts` dependency under its own tsconfig with the
 * transform plugin that tsconfig declares.
 *
 * A source-shipping package can need a transform to behave correctly (typia's
 * fixtures build their values with `typia.createRandom`, for example). ttsx
 * must build the dependency through its own tsconfig and selected transform,
 * rather than merely stripping types. Current runtime emission also requires
 * supported provenance; finding output in a directory alone is not authority
 * to execute it. This case observes the final native-transform/runtime effects,
 * not every private provenance record or reported file list.
 *
 * `@ttsc/strip` is configured in the dependency to drop `console.log`. The
 * dependency runs a `console.log` side effect at import time; if the transform
 * ran, that line is gone and only the entry's own output remains.
 *
 * 1. Install a `dep` whose own tsconfig declares `@ttsc/strip` and whose entry
 *    logs a secret at module scope.
 * 2. Run ttsx against an entry that imports the dependency for its value.
 * 3. Assert the secret was stripped and the dependency's value is intact.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual runtime must print only entry:dependency-value, so the imported package value survives and its secret log is removed.
 * @evidence contracts/testing.md#independent-expectations The dependency explicitly authors a secret side effect and literal value; exact combined stdout excludes executing untranslated dependency input.
 * @evidence contracts/testing.md#distinguishing-cases Owns raw-source dependency resolution under its own tsconfig and real workspace strip source host before runtime execution; final stdout is not a complete provenance-envelope oracle.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named driver export in the generic E2E population. It owns one public ttsx request and the resulting dependency/runtime effects, not an independently selected Linux-only entry or an inferred child/Program count.
 * @evidence contracts/e2e.md#necessary-boundary The public runtime must discover the dependency project, assemble its strip host and execute the transformed dependency output; pure strip or cache-query units cannot prove this connection.
 * @evidence contracts/e2e.md#shared-execution seedPackages junction-links the unchanged workspace strip package and this request explicitly selects the suite-owned shared plugin cache. This is not a packed installation, cold-build assertion or independently observed hit/build/Program/process total/minimum preparation cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks the fresh consumer's entry/dependency/config trees; suite cache and workspace producer are not consumer cleanup targets. Production source/config/toolchain identity governs cache eligibility. Error/signal/status are checked before stdout; synchronous return does not certify arbitrary descendants, every private emitted-generation record or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original CLI success and exact stdout retain both secret-removal and dependency-value assertions.
 */
export function test_ttsx_builds_a_dependency_with_its_own_transform_plugin(): void {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_builds_a_dependency_with_its_own_transform_plugin/inputs-1"));
    TestUtilityPlugins.seedPackages(root, ["strip"]);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: TestProject.sharedPluginCache(),
        },
      },
    );

    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "entry:dependency-value");
  }

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ProjectFixtures } from "../../../../internal/ttsc/internal/ProjectFixtures";
import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * Verifies ttsc utility plugins: lint, banner, paths, and strip run together in
 * ttsc build.
 *
 * All four utility plugins must compose into a single linked-host binary: lint
 * as a separate check-stage source plugin and banner/paths/strip sharing one
 * transform-stage linked host. This test exercises the full combination to
 * guard against regressions in multi-contributor host wiring and cross-plugin
 * output ordering.
 *
 * 1. Copy the `ttsc-utility-plugins` fixture project and seed `node_modules`.
 * 2. Run `ttsc --emit`.
 * 3. Assert the linked host was built with 3 contributors, lint ran as a separate
 *    source plugin, path aliases were rewritten, banner was prepended exactly
 *    once, and `console.log`/`debugger`/`assert` were stripped.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual cold build wires lint separately and three linked contributors, then checks transformed JavaScript/declarations, runtime output and both source-map versions.
 * @evidence contracts/testing.md#independent-expectations Literal contributor count/build messages and hello:ok output independently establish assembly; original banner count, relative import patterns, removed statement patterns and map version 3 define emitted contracts.
 * @evidence contracts/testing.md#distinguishing-cases Owns simultaneous check plus transform-stage assembly, ordered JS/d.ts effects and executable output; raw-host and host-own-transform cases remain separate minimal transform protocol owners.
 * @evidence contracts/testing.md#execution-ownership The matching named utility export owns the real combined build and one emitted-program invocation in the Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary The loader must assemble three linked contributor hooks beside an independent check-stage lint producer and publish their combined outputs; separate pure transform units cannot establish this wiring or ordering.
 * @evidence contracts/e2e.md#shared-execution One necessary cold plugin cache observes both binary publications, while the shared Go object cache reuses identical compiler/contributor objects; all output assertions use that one build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh plugin entries preserve cold build messages; the copied consumer fixture and emitted runtime are local, immutable workspace producer sources and Go objects alone are reused.
 * @evidence contracts/e2e.md#preserved-coverage Every original build-message, contributor-count, JS/d.ts banner/import/strip assertion, hello:ok runtime assertion and both map-version assertions stays in this single build.
 */
export function test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build(): void {
  const root = ProjectFixtures.copy("ttsc-utility-plugins");
  TestUtilityPlugins.seedPackages(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-utility-combo-"),
        TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /building linked plugin host "linked-plugin-host"/,
  );
  assert.match(result.stderr, /\+ 3 contributor\(s\):/);
  assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);

  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  TestUtilityPlugins.assertSingleBanner(js, "utility combo");
  assert.match(js, /require\("\.\/modules\/join\.js"\)/);
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /console\.(?:log|debug)/);
  assert.doesNotMatch(js, /\bdebugger\b/);
  assert.doesNotMatch(js, /assert\.equal/);

  const run = TestProject.runNode(path.join(root, "dist", "main.js"), {
    cwd: root,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "hello:ok");

  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  TestUtilityPlugins.assertSingleBanner(dts, "utility combo");
  assert.match(dts, /import\("\.\/modules\/join\.js"\)/);
  assert.match(dts, /import\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(dts, /@lib\/join|exact-message/);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8"))
      .version,
    3,
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(root, "dist", "main.d.ts.map"), "utf8"),
    ).version,
    3,
  );
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

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
 */
export const test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build =
  () => {
    const root = TestProject.copyProject("ttsc-utility-plugins");
    TestUtilityPlugins.seedPackages(root);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-utility-combo-"),
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
      JSON.parse(
        fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8"),
      ).version,
      3,
    );
    assert.equal(
      JSON.parse(
        fs.readFileSync(path.join(root, "dist", "main.d.ts.map"), "utf8"),
      ).version,
      3,
    );
  };

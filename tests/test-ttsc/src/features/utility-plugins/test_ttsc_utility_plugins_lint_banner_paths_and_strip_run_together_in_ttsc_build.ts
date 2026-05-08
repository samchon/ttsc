import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyProject, runNode, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: lint, banner, paths, and strip run together in ttsc build.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build =
  () => {
    const root = copyProject("ttsc-utility-plugins");
    TestTtscUtilityPlugins.seedUtilityPackages(root);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-utility-combo-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);
    assert.match(result.stderr, /building source plugin "@ttsc\/banner"/);
    assert.match(result.stderr, /building source plugin "@ttsc\/paths"/);
    assert.match(result.stderr, /building source plugin "@ttsc\/strip"/);

    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    TestTtscUtilityPlugins.assertSingleBanner(js, "utility combo");
    assert.match(js, /require\("\.\/modules\/join\.js"\)/);
    assert.match(js, /require\("\.\/modules\/message\.js"\)/);
    assert.doesNotMatch(js, /console\.(?:log|debug)/);
    assert.doesNotMatch(js, /\bdebugger\b/);
    assert.doesNotMatch(js, /assert\.equal/);

    const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "hello:ok");

    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    TestTtscUtilityPlugins.assertSingleBanner(dts, "utility combo");
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

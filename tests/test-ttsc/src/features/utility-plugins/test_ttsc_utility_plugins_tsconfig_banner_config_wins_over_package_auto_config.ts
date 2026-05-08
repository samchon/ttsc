import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: tsconfig banner config wins over package auto config.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_tsconfig_banner_config_wins_over_package_auto_config =
  () => {
    const root = commonJsProject(
      {
        "banner.config.cjs": `module.exports = "auto banner";\n`,
        "src/main.ts": `export const value = "banner";\n`,
      },
      {
        compilerOptions: {
          plugins: [
            { transform: "@ttsc/banner", config: "./config/banner.config.cjs" },
          ],
        },
      },
    );
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "config", "banner.config.cjs"),
      `module.exports = { text: "explicit banner" };\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/banner": "0.8.1" } }),
    );
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["banner"]);

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-auto-banner-explicit-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    TestTtscUtilityPlugins.assertSingleBanner(js, "explicit banner");
    assert.doesNotMatch(js, /auto banner/);
  };

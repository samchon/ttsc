import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: auto-discovered banner fails when no config file exists.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_auto_discovered_banner_fails_when_no_config_file_exists =
  () => {
    const root = commonJsProject({
      "src/main.ts": `export const value = "banner";\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@ttsc/banner": "0.8.1" } }),
    );
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["banner"]);

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-auto-banner-missing-config-"),
        ),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /banner\.config\.\{js,cjs,mjs,ts,mts,cts\}/);
  };

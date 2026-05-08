import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: banner preserves executable shebang.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_banner_preserves_executable_shebang =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": `#!/usr/bin/env node\nexport const value = "cli";\nconsole.log(value);\n`,
      },
      {
        compilerOptions: {
          plugins: [
            {
              transform: "@ttsc/banner",
              text: "cli banner",
            },
          ],
        },
      },
    );
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["banner"]);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-utility-banner-shebang-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.equal(js.startsWith("#!/usr/bin/env node\n"), true, js);
    TestTtscUtilityPlugins.assertSingleBanner(js, "cli banner");
  };

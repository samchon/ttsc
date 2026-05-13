import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: auto-discovered banner fails when no config
 * file exists.
 *
 * This banner feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/banner as a project plugin.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_banner_auto_discovered_config_requires_banner_config_file =
  () => {
    const root = TestProject.commonJsProject({
      "src/main.ts": `export const value = "banner";\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@ttsc/banner": "*" } }),
    );
    TestBanner.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestBanner.goPath(),
          TTSC_CACHE_DIR: fs.mkdtempSync(
            path.join(os.tmpdir(), "ttsc-auto-banner-missing-config-"),
          ),
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /banner\.config\.\{js,cjs,mjs,ts,mts,cts\}/);
  };

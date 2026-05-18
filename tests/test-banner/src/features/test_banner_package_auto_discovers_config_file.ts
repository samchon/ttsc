import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: package ttsc.plugin auto-discovers banner
 * config files.
 *
 * This banner feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/banner as a project plugin.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_banner_package_auto_discovers_config_file = () => {
  const root = TestProject.commonJsProject({
    "banner.config.cjs": `module.exports = { text: "auto banner" };\n`,
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-auto-banner-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  TestBanner.assertSingleBanner(js, "auto banner");
};

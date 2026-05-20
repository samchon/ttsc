import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: package ttsc.plugin auto-discovers banner
 * config files.
 *
 * When `@ttsc/banner` is listed in `package.json` dependencies (with no
 * matching tsconfig plugin entry), the banner plugin is registered
 * automatically and its config is read from a `banner.config.*` file found in
 * the project root. This pins the happy-path of the auto-discovery flow so a
 * regression in config-file lookup breaks loudly here rather than in an
 * end-user project.
 *
 * 1. Create a CommonJS project with a `banner.config.cjs` file and a
 *    `package.json` that lists `@ttsc/banner` as a dependency.
 * 2. Run `ttsc --emit` without any tsconfig plugin configuration.
 * 3. Assert the emitted `.js` file contains exactly one auto-discovered banner
 *    block with the text from `banner.config.cjs`.
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

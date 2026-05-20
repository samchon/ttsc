import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: tsconfig banner config wins over package
 * auto config.
 *
 * When both auto-discovery (`@ttsc/banner` in `package.json`) and an explicit
 * tsconfig plugin entry with a `config` path are present, the tsconfig entry
 * takes precedence. Without this precedence rule the auto-discovered config
 * would silently shadow an explicit override, making the tsconfig `config`
 * field effectively a no-op whenever the package is also installed.
 *
 * 1. Create a project with an auto-discoverable `banner.config.cjs` in the root
 *    and a second, explicit config under `config/banner.config.cjs` that the
 *    tsconfig plugin entry references via `config`.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert only the explicit config's banner text appears in the output and the
 *    auto-discovered text is absent.
 */
export const test_banner_tsconfig_config_overrides_package_auto_config = () => {
  const root = TestProject.commonJsProject(
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
    JSON.stringify({ devDependencies: { "@ttsc/banner": "*" } }),
  );
  TestBanner.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestBanner.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-auto-banner-explicit-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  TestBanner.assertSingleBanner(js, "explicit banner");
  assert.doesNotMatch(js, /auto banner/);
};

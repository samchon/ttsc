import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification A dependency-only package manifest and adjacent CJS config must emit exactly one auto banner block.
 * @evidence contracts/testing.md#independent-expectations Authored dependency and config text define the expected discovery result independently of the loader.
 * @evidence contracts/testing.md#distinguishing-cases No tsconfig plugin entry is present; explicit/duplicate registration and absent config are complementary cases.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_package_auto_discovers_config_file entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Dependency package discovery must register and configure a plugin that was never named in tsconfig.
 * @evidence contracts/e2e.md#shared-execution The dependency-only registration context requires a separate load from explicit and conflicting registration contexts. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage A dependency-only package manifest and adjacent CJS config must emit exactly one auto banner block. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_package_auto_discovers_config_file() {
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
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  TestBanner.assertSingleBanner(js, "auto banner");
}

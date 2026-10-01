import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: tsconfig `configFile` wins over package
 * auto-discovery.
 *
 * When both auto-discovery (`@ttsc/banner` in `package.json`) and an explicit
 * tsconfig plugin entry with a `configFile` path are present, the tsconfig
 * entry takes precedence. Without this precedence rule the auto-discovered
 * config would silently shadow an explicit override, making the tsconfig
 * `configFile` field effectively a no-op whenever the package is also
 * installed.
 *
 * 1. Create a project with an auto-discoverable `banner.config.cjs` in the root
 *    and a second, explicit config under `config/banner.config.cjs` that the
 *    tsconfig plugin entry references via `configFile`.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert only the explicit config's banner text appears in the output and the
 *    auto-discovered text is absent.
 *
 * @evidence contracts/testing.md#behavioral-verification Explicit config must emit one explicit banner and no auto banner despite the dependency and competing root config.
 * @evidence contracts/testing.md#independent-expectations The explicit configFile contract gives the authored custom file precedence over package auto discovery.
 * @evidence contracts/testing.md#distinguishing-cases Both inputs are eligible and carry distinct texts, distinguishing ignored explicit pointers and duplicate plugin application.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_tsconfig_config_overrides_package_auto_config entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Host registration deduplication and configFile transfer must select the explicit input before native output publication.
 * @evidence contracts/e2e.md#shared-execution Competing dependency and explicit registration require their own project load; the configured and absent-registration cases cannot establish precedence. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Explicit config must emit one explicit banner and no auto banner despite the dependency and competing root config. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_tsconfig_config_overrides_package_auto_config() {
  const root = TestProject.commonJsProject(
    {
      "banner.config.cjs": `module.exports = { text: "auto banner" };\n`,
      "src/main.ts": `export const value = "banner";\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/banner",
            configFile: "./config/banner.config.cjs",
          },
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
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  TestBanner.assertSingleBanner(js, "explicit banner");
  assert.doesNotMatch(js, /auto banner/);
}

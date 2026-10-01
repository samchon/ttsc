import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../../../internal/banner/internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/banner/internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: a JSON config file is loaded and its text
 * is injected into the emitted output.
 *
 * JSON is the simplest config format — no Node subprocess or ttsx run required.
 * A `banner.config.json` file containing an object with a `"text"` key must be
 * parsed natively and its content injected as the banner. This test pins the
 * JSON loader path so a regression in parsing this plain object fails loudly
 * here rather than silently suppressing the banner.
 *
 * 1. Create a CommonJS project with a `banner.config.json` that exports the `{
 *    "text": "…" }` object, referenced via `configFile`.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert the emitted `.js` file contains the expected banner block.
 *
 * @evidence contracts/testing.md#behavioral-verification Explicit banner.config.json must produce exactly one json banner preamble in emitted JS.
 * @evidence contracts/testing.md#independent-expectations The authored JSON text and packageDocumentation contract establish the expected unique block.
 * @evidence contracts/testing.md#distinguishing-cases JSON parsing and explicit configFile selection are positive; executable CJS loading and missing config have separate cases.
 * @evidence contracts/testing.md#execution-ownership This case_banner_json_config_file_loads_banner_text scene is called by test_banner_native_boundary_batch through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor configFile must reach native JSON configuration and actual emitted output.
 * @evidence contracts/e2e.md#shared-execution The native JSON-only loader input differs from executable CJS configuration, requiring its own config load. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Explicit banner.config.json must produce exactly one json banner preamble in emitted JS. All original assertions remain in this scene of the native boundary batch. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function case_banner_json_config_file_loads_banner_text() {
  const root = TestProject.commonJsProject(
    FixtureFiles.read("banner/banner_json_config_file_loads_banner_text/inputs-1"),
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/banner",
            configFile: "banner.config.json",
          },
        ],
      },
    },
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
  TestBanner.assertSingleBanner(js, "json banner");
}

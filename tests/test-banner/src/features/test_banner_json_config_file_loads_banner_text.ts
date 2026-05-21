import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: a JSON config file is loaded and its text
 * is injected into the emitted output.
 *
 * JSON is the simplest config format — no Node subprocess or ttsx run required.
 * A `banner.config.json` file containing an object with a `"text"` key must be
 * parsed natively and its content injected as the banner. This test pins the
 * JSON loader path so a regression in BOM handling or JSON parsing fails loudly
 * here rather than silently suppressing the banner.
 *
 * 1. Create a CommonJS project with a `banner.config.json` that exports the `{
 *    "text": "…" }` object, referenced via `configFile`.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert the emitted `.js` file contains the expected banner block.
 */
export const test_banner_json_config_file_loads_banner_text = () => {
  const root = TestProject.commonJsProject(
    {
      "banner.config.json": JSON.stringify({ text: "json banner" }),
      "src/main.ts": `export const value = "json";\n`,
    },
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-banner-json-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  TestBanner.assertSingleBanner(js, "json banner");
};

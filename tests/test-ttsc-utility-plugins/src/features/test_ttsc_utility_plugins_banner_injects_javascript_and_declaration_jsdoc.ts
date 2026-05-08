import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: banner injects JavaScript and declaration JSDoc.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_banner_injects_javascript_and_declaration_jsdoc =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
      },
      {
        compilerOptions: {
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          plugins: [
            {
              transform: "@ttsc/banner",
              text: "banner-only\nsecond line",
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
          path.join(os.tmpdir(), "ttsc-utility-banner-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    const jsMap = fs.readFileSync(
      path.join(root, "dist", "main.js.map"),
      "utf8",
    );
    const dtsMap = fs.readFileSync(
      path.join(root, "dist", "main.d.ts.map"),
      "utf8",
    );
    TestTtscUtilityPlugins.assertSingleBanner(js, "banner-only\nsecond line");
    TestTtscUtilityPlugins.assertSingleBanner(dts, "banner-only\nsecond line");
    assert.match(js, /\n\/\/# sourceMappingURL=main\.js\.map$/);
    assert.match(dts, /\n\/\/# sourceMappingURL=main\.d\.ts\.map$/);
    assert.doesNotMatch(jsMap, /@packageDocumentation|banner-only/);
    assert.doesNotMatch(dtsMap, /@packageDocumentation|banner-only/);
    assert.equal(JSON.parse(jsMap).version, 3);
    assert.equal(JSON.parse(dtsMap).version, 3);
  };

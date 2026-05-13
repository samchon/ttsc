import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: banner injects JavaScript and declaration
 * JSDoc.
 *
 * This banner feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/banner as a project plugin.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_banner_injects_javascript_and_declaration_jsdoc = () => {
  const root = TestProject.commonJsProject(
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
  TestBanner.seedPackage(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestBanner.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-banner-")),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  const jsMap = fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8");
  const dtsMap = fs.readFileSync(
    path.join(root, "dist", "main.d.ts.map"),
    "utf8",
  );
  TestBanner.assertSingleBanner(js, "banner-only\nsecond line");
  TestBanner.assertSingleBanner(dts, "banner-only\nsecond line");
  assert.match(js, /\n\/\/# sourceMappingURL=main\.js\.map$/);
  assert.match(dts, /\n\/\/# sourceMappingURL=main\.d\.ts\.map$/);
  assert.doesNotMatch(jsMap, /@packageDocumentation|banner-only/);
  assert.doesNotMatch(dtsMap, /@packageDocumentation|banner-only/);
  assert.equal(JSON.parse(jsMap).version, 3);
  assert.equal(JSON.parse(dtsMap).version, 3);
};

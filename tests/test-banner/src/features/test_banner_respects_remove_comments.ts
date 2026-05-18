import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: banner follows removeComments.
 *
 * This banner feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/banner as a project plugin.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_banner_respects_remove_comments = () => {
  const root = TestProject.commonJsProject(
    {
      "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
        removeComments: true,
        plugins: [
          {
            transform: "@ttsc/banner",
            text: "removed banner",
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-banner-remove-comments-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
};

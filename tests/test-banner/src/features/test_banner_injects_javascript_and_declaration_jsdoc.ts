import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: banner injects JavaScript and declaration
 * JSDoc.
 *
 * The banner text must appear as a `@packageDocumentation` JSDoc block at the
 * top of both the `.js` and `.d.ts` outputs, but must NOT bleed into the
 * accompanying source-map files (otherwise source positions shift and debugging
 * becomes misleading). This test pins the happy-path of the core banner
 * transform including multi-line text, source maps, and declaration maps.
 *
 * 1. Build a project with `declaration`, `declarationMap`, and `sourceMap`
 *    enabled, and a tsconfig plugin entry that sets `text` to a two-line
 *    string.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert the banner JSDoc block appears exactly once in `.js` and `.d.ts`.
 * 4. Assert the `.js.map` and `.d.ts.map` files contain no banner text.
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-banner-"),
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

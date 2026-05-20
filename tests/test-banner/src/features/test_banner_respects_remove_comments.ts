import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: banner follows removeComments.
 *
 * When `compilerOptions.removeComments` is `true`, TypeScript-Go strips all
 * JSDoc and block comments from the output. The banner is itself a JSDoc block,
 * so the banner plugin must respect this flag and suppress its own output
 * rather than re-inserting a comment that the compiler just removed. Without
 * this guard the banner would survive `removeComments`, defeating the user's
 * intent and polluting minified builds.
 *
 * 1. Create a project with `removeComments: true` and a tsconfig banner plugin
 *    entry referencing a known banner text.
 * 2. Run `ttsc --emit` (declarations enabled) against that project.
 * 3. Assert the emitted `.js` and `.d.ts` files contain neither the banner text
 *    nor a `@packageDocumentation` tag.
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

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

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
 * 1. Create a project with `removeComments: true` and a `banner.config.cjs` file
 *    referenced via `configFile` in the tsconfig plugin entry.
 * 2. Run `ttsc --emit` (declarations enabled) against that project.
 * 3. Assert the emitted `.js` and `.d.ts` files contain neither the banner text
 *    nor a `@packageDocumentation` tag.
 */
export const test_banner_respects_remove_comments = () => {
  const root = TestProject.commonJsProject(
    {
      "banner.config.cjs": `module.exports = { text: "removed banner" };\n`,
      "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
        removeComments: true,
        plugins: [
          {
            transform: "@ttsc/banner",
            configFile: "banner.config.cjs",
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
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
};

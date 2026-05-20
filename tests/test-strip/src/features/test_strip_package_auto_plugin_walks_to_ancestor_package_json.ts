import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: package ttsc.plugin walks to ancestor
 * package.json.
 *
 * The strip auto-discovery path looks for `@ttsc/strip` in the nearest
 * `package.json`, but in a monorepo the sub-package tsconfig often lives in
 * `packages/app/` while the root `package.json` is two directories up. The
 * plugin loader must walk ancestor directories to find the root manifest,
 * otherwise monorepo users are forced to duplicate the dependency in every
 * sub-package.
 *
 * 1. Create a monorepo-shaped project: root `package.json` with `@ttsc/strip`,
 *    sub-package at `packages/app/` with its own `tsconfig.json` but no
 *    `package.json`.
 * 2. Run `ttsc --emit` from the sub-package working directory.
 * 3. Assert zero exit and that `console.log` and `debugger` are absent from the
 *    emitted `.js` output.
 */
export const test_strip_package_auto_plugin_walks_to_ancestor_package_json =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        dependencies: { "@ttsc/strip": "*" },
      }),
      "packages/app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "packages/app/src/main.ts": [
        `console.log("drop-log");`,
        `debugger;`,
        `export const value = "kept";`,
        ``,
      ].join("\n"),
    });
    TestStrip.seedPackage(root);

    const project = path.join(root, "packages", "app");
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", project, "--emit"],
      {
        cwd: project,
        env: {
          PATH: TestStrip.goPath(),
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-ancestor-strip-"),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(project, "dist", "main.js"), "utf8");
    assert.match(js, /kept/);
    assert.doesNotMatch(js, /console\.log|\bdebugger\b/);
  };

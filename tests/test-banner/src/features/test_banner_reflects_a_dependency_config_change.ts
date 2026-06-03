import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies `ttsx` reflects a change to a dependency's `@ttsc/banner` config on
 * the next run.
 *
 * The runner emits each dependency fresh through its own plugin host rather than
 * a durable cache, so a change to `banner.config.cjs` is picked up the next run
 * with no invalidation step to get wrong. The dependency's emitted JavaScript —
 * captured by a `load` hook the entry installs — carries the new banner text.
 *
 * 1. Compile a symlinked raw-`.ts` dependency with `@ttsc/banner` and capture
 *    the emitted JavaScript; assert the first banner.
 * 2. Change only `banner.config.cjs`.
 * 3. Run again and assert the captured emit carries the new banner.
 */
export const test_banner_reflects_a_dependency_config_change = () => {
  const capture = "dep-emit.js";
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "commonjs", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "ES2022",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "packages/dep/package.json": JSON.stringify({
      name: "dep",
      version: "1.0.0",
      type: "commonjs",
      exports: { ".": "./src/index.ts" },
      dependencies: { "@ttsc/banner": "*" },
    }),
    "packages/dep/banner.config.cjs": `module.exports = { text: "banner-v1" };\n`,
    "packages/dep/tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "ES2022",
        strict: true,
        outDir: "lib",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "packages/dep/src/index.ts": `export const greet = (): string => "from-dep";\n`,
    "src/main.ts": captureEntry(),
  });
  TestBanner.seedPackage(root);
  fs.symlinkSync(
    path.join(root, "packages", "dep"),
    path.join(root, "node_modules", "dep"),
    "junction",
  );

  const run = () =>
    TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: {
        PATH: TestBanner.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        BANNER_CAPTURE: path.join(root, capture),
      },
    });

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.trim(), "from-dep");
  TestBanner.assertSingleBanner(
    fs.readFileSync(path.join(root, capture), "utf8"),
    "banner-v1",
  );

  fs.writeFileSync(
    path.join(root, "packages", "dep", "banner.config.cjs"),
    `module.exports = { text: "banner-v2" };\n`,
  );

  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout.trim(), "from-dep");
  TestBanner.assertSingleBanner(
    fs.readFileSync(path.join(root, capture), "utf8"),
    "banner-v2",
  );
};

/**
 * The entry program: it registers a `load` hook (outermost, since it runs after
 * ttsx installed its own) that writes the dependency's emitted JavaScript to the
 * file named by `BANNER_CAPTURE`, then loads the dependency so the hook observes
 * the banner ttsx applied to its raw `.ts`.
 */
function captureEntry(): string {
  return [
    `declare function require(name: string): any;`,
    `declare const process: { env: { [key: string]: string | undefined } };`,
    `const runtime = require("node:module");`,
    `const fs = require("node:fs");`,
    `runtime.registerHooks({`,
    `  load: (url: string, context: unknown, next: (u: string, c: unknown) => any): any => {`,
    `    const result = next(url, context);`,
    `    const target = process.env.BANNER_CAPTURE;`,
    `    if (target !== undefined && url.indexOf("/dep/") >= 0) {`,
    `      fs.writeFileSync(target, String(result.source));`,
    `    }`,
    `    return result;`,
    `  },`,
    `});`,
    `const dep = require("dep");`,
    `console.log(dep.greet());`,
    ``,
  ].join("\n");
}

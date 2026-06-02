import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies @ttsc/banner rebuilds a ttsx dependency cache when config changes.
 *
 * Raw-`.ts` dependencies keep a persistent per-package emit cache. That cache
 * must be invalidated by plugin configuration as well as source edits;
 * otherwise a dependency compiled with `banner.config.cjs` keeps serving stale
 * transformed JavaScript after the banner text changes.
 *
 * 1. Compile a symlinked raw-`.ts` dependency with `@ttsc/banner`.
 * 2. Change only `banner.config.cjs`, leaving TypeScript sources untouched.
 * 3. Run ttsx again and assert the dependency emit contains the new banner.
 */
export const test_banner_rebuilds_ttsx_dependency_cache_when_config_changes =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "packages/dep/package.json": JSON.stringify({
        name: "dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
        dependencies: { "@ttsc/banner": "*" },
      }),
      "packages/dep/banner.config.cjs": `module.exports = { text: "banner-v1" };\n`,
      "packages/dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "packages/dep/src/index.ts": `export const greet = (): string => "from-dep";\n`,
      "src/main.ts": `import { greet } from "dep";\nconsole.log(greet());\n`,
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
        },
      });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "from-dep");
    assertBanner(root, "banner-v1");

    const config = path.join(root, "packages", "dep", "banner.config.cjs");
    fs.writeFileSync(config, `module.exports = { text: "banner-v2" };\n`);
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(config, future, future);

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "from-dep");
    assertBanner(root, "banner-v2");
  };

function assertBanner(root: string, text: string): void {
  const emitted = findCompiledDependencyEntry(
    path.join(root, "packages", "dep"),
  );
  assert.notEqual(emitted, null, "the dependency package was compiled");
  TestBanner.assertSingleBanner(fs.readFileSync(emitted!, "utf8"), text);
}

/** Locate the `index.js` `ttsx` emitted for a compiled dependency package. */
function findCompiledDependencyEntry(packageRoot: string): string | null {
  const stack = [
    path.join(packageRoot, "node_modules", ".cache", "ttsc", "ttsx-deps"),
  ];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && entry.name === "index.js") {
        return next;
      }
    }
  }
  return null;
}

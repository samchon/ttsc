import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx rebuilds a dependency cache when a source's content changes but
 * its mtime is pinned to the original value.
 *
 * On a filesystem with coarse mtime resolution an edit can land in the same
 * mtime tick as the build, so a stamp keyed on mtime alone would serve stale
 * emit forever. The freshness stamp therefore also folds in each input's size;
 * this is the negative twin of the mtime-advances rebuild tests, which all push
 * mtime into the future and so never exercise a same-mtime edit.
 *
 * 1. Run once and record the dependency's emitted value.
 * 2. Edit the source to a different length, then reset its mtime to the original.
 * 3. Run again and assert the new value is served (the cache was rebuilt).
 */
export const test_ttsx_rebuilds_a_dependency_cache_when_a_source_changes_at_a_fixed_mtime =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/mtime-dep/package.json": JSON.stringify({
        name: "mtime-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/mtime-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/mtime-dep/src/index.ts": `export const value = (): string => "first-value";\n`,
      "src/main.ts": `import { value } from "mtime-dep";\nconsole.log(value());\n`,
    });

    const run = () =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
        cwd: root,
      });
    const source = path.join(
      root,
      "node_modules",
      "mtime-dep",
      "src",
      "index.ts",
    );
    const original = fs.statSync(source);

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "first-value");

    // Edit to a different length and pin the mtime back to the original.
    fs.writeFileSync(
      source,
      `export const value = (): string => "second-and-longer-value";\n`,
    );
    fs.utimesSync(source, original.atime, original.mtime);

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "second-and-longer-value");
  };

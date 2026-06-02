import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies `ttsx` rebuilds a dependency's per-package cache when a config it
 * `extends` changes, even though no source and no leaf tsconfig was touched.
 *
 * A base config lives outside the package and is never enumerated among the
 * package's `.ts` sources, so the freshness stamp cannot see an edit to it via
 * source mtimes. The stamp therefore hashes the package's _resolved_ compiler
 * options (merged through the whole `extends` chain); a change to the base —
 * here `target` — alters those options and must invalidate the cache. A
 * regression that hashed only the leaf tsconfig or the sources would serve
 * stale emit forever after a base-config change.
 *
 * 1. Build a `cfg-dep` whose `tsconfig.json` extends a base config at the project
 *    root and record the emitted JavaScript's mtime.
 * 2. Edit only the base config's `target` (advancing its mtime), run again.
 * 3. Assert the emit was rebuilt (mtime advanced).
 */
export const test_ttsx_rebuilds_a_dependency_cache_when_its_extends_base_changes =
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
      // Base config at the project root — outside cfg-dep's enumerated sources.
      "base.tsconfig.json": JSON.stringify({
        compilerOptions: { target: "ES2017" },
      }),
      "node_modules/cfg-dep/package.json": JSON.stringify({
        name: "cfg-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/cfg-dep/tsconfig.json": JSON.stringify({
        extends: "../../base.tsconfig.json",
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/cfg-dep/src/index.ts": `export const value = (): string => "ok";\n`,
      "src/main.ts": `import { value } from "cfg-dep";\nconsole.log(value());\n`,
    });

    const run = () =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
        cwd: root,
      });
    const depRoot = path.join(root, "node_modules", "cfg-dep");

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "ok");
    const emit = findEmittedEntry(depRoot);
    assert.notEqual(emit, null, "the dependency compiled into its cache");
    const firstMtime = fs.statSync(emit!).mtimeMs;

    // Edit ONLY the base config (no source edit, no leaf-tsconfig edit).
    const base = path.join(root, "base.tsconfig.json");
    fs.writeFileSync(
      base,
      JSON.stringify({ compilerOptions: { target: "ES2022" } }),
    );
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(base, future, future);

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    const rebuilt = findEmittedEntry(depRoot);
    assert.notEqual(rebuilt, null, "the dependency recompiled");
    assert.ok(
      fs.statSync(rebuilt!).mtimeMs > firstMtime,
      "editing an extends-base config invalidates the per-package cache",
    );
  };

/** Locate the `index.js` `ttsx` emitted for a compiled dependency package. */
function findEmittedEntry(packageRoot: string): string | null {
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

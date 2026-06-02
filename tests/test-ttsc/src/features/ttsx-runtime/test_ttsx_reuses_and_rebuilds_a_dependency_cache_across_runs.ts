import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies `ttsx` reuses a dependency's per-package cache across runs and
 * rebuilds it when the dependency's source changes.
 *
 * A raw-`.ts` dependency is compiled by tsgo into a per-package cache on first
 * use. A later run must reuse that cache untouched when nothing changed (the
 * whole point of the freshness stamp) and rebuild it when a source is edited.
 * Because each `ttsx` invocation is a fresh process, only the on-disk stamp —
 * never an in-process memo — governs reuse, so this is the only guard against a
 * stamp that silently never matches (rebuild every run) or always matches
 * (serve stale emit forever).
 *
 * 1. Run once and record the emitted dependency JavaScript's mtime.
 * 2. Run again unchanged: the original value prints and the emit is the same file
 *    (mtime unchanged) — reused, not rebuilt.
 * 3. Edit the dependency's source (advancing its mtime), run again: the new value
 *    prints and the emit was rebuilt (mtime advanced).
 */
export const test_ttsx_reuses_and_rebuilds_a_dependency_cache_across_runs =
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
      "node_modules/cache-dep/package.json": JSON.stringify({
        name: "cache-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/cache-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/cache-dep/src/index.ts": `export const value = (): string => "v1";\n`,
      "src/main.ts": `import { value } from "cache-dep";\nconsole.log(value());\n`,
    });

    const run = () =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
        cwd: root,
      });
    const depRoot = path.join(root, "node_modules", "cache-dep");
    const cacheDir = path.join(
      depRoot,
      "node_modules",
      ".cache",
      "ttsc",
      "ttsx-deps",
    );

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "v1");

    assert.notEqual(
      findEmittedEntry(depRoot),
      null,
      "the dependency compiled into its per-package cache",
    );
    // Plant a witness file in the cache directory. Reuse leaves the directory
    // untouched (the witness survives); a rebuild renames a fresh staging
    // directory over it (the witness is gone). This proves the stamp-match path
    // directly — unlike an emit-file mtime, which a deterministic re-emit could
    // reproduce identically.
    const witness = path.join(cacheDir, ".reuse-witness");
    fs.writeFileSync(witness, "");

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "v1");
    assert.ok(
      fs.existsSync(witness),
      "an unchanged dependency is served from cache, not rebuilt",
    );

    // Edit the source and advance its mtime so the freshness stamp changes.
    const source = path.join(depRoot, "src", "index.ts");
    fs.writeFileSync(source, `export const value = (): string => "v2";\n`);
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(source, future, future);

    const third = run();
    assert.equal(third.status, 0, third.stderr);
    assert.equal(third.stdout.trim(), "v2");
    assert.notEqual(
      findEmittedEntry(depRoot),
      null,
      "the edited dependency recompiled",
    );
    assert.ok(
      !fs.existsSync(witness),
      "an edited dependency is rebuilt (the cache directory was replaced)",
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

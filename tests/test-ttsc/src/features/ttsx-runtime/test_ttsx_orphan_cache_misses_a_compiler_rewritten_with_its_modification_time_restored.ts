import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the persistent orphan lowering cache is missed after the compiler is
 * rewritten in place with its size kept and its modification time restored.
 *
 * The cache key names the compiler by its filesystem identity instead of its
 * content. That identity was the path, size, modification time, and file id,
 * all of which a same-size rewrite that restores the modification time leaves
 * as they were, so a later process reused a lowering from a compiler that may
 * no longer be the one at that path (samchon/ttsc#1521). The change time moves
 * with every write and cannot be restored, so it is part of the identity now.
 *
 * 1. Copy the compiler to a fixed path and run an entry that requires a raw
 *    TypeScript package with no tsconfig, with a private `TTSC_CACHE_DIR`.
 * 2. Plant a marker in the one cached lowering and run again.
 * 3. Rewrite the compiler with the same bytes and restore its modification time,
 *    then run a third time.
 * 4. Assert the second run printed the marker and the third did not.
 */
export const test_ttsx_orphan_cache_misses_a_compiler_rewritten_with_its_modification_time_restored =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "orphan-cache", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => { value: string };`,
        `console.log(require("rawpkg").value);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/rawpkg/package.json": JSON.stringify({
        name: "rawpkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/rawpkg/index.ts": `export const value: string = "lowered";\n`,
    });
    // The compiler finds its `lib.*.d.ts` beside itself, so its directory
    // moves with it.
    const compilerDir = path.join(root, "compiler");
    fs.cpSync(path.dirname(TestProject.TSGO_BINARY), compilerDir, {
      recursive: true,
    });
    const compiler = path.join(
      compilerDir,
      path.basename(TestProject.TSGO_BINARY),
    );
    fs.chmodSync(compiler, 0o755);
    const cacheDir = path.join(root, "orphan-cache");
    const run = () =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
        cwd: root,
        env: { TTSC_CACHE_DIR: cacheDir, TTSC_TSGO_BINARY: compiler },
      });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "lowered");
    const orphanDir = path.join(cacheDir, "ttsx-orphan");
    const cached = fs
      .readdirSync(orphanDir)
      .filter((name) => name.endsWith(".js"));
    assert.equal(cached.length, 1, cached.join(", "));
    fs.appendFileSync(
      path.join(orphanDir, cached[0]!),
      `\nconsole.log("served from cache");\n`,
    );

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /served from cache/);

    const before = fs.statSync(compiler);
    fs.writeFileSync(compiler, fs.readFileSync(compiler));
    // Seconds with a fraction keep the sub-millisecond part a `Date` drops.
    fs.utimesSync(compiler, before.atimeMs / 1000, before.mtimeMs / 1000);
    assert.equal(fs.statSync(compiler).mtimeMs, before.mtimeMs);
    assert.equal(fs.statSync(compiler).size, before.size);
    const third = run();
    assert.equal(third.status, 0, third.stderr);
    assert.equal(third.stdout.trim(), "lowered");
  };

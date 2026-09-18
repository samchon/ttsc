import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the persistent orphan lowering cache is not reused after the
 * compiler at the same path is replaced.
 *
 * Pins samchon/ttsc#1405. Raw TypeScript no project owns is lowered once and
 * cached under `TTSC_CACHE_DIR`, across runs. The key named the compiler by its
 * path, so upgrading `typescript` in a flat `node_modules`, which replaces the
 * binary where it stands, kept serving the old compiler's output. The key now
 * carries the binary's identity. A marker planted in the cached text makes
 * reuse observable without a second compiler: the cache is reused while the
 * binary is unchanged, and missed once the binary is rewritten in place.
 *
 * 1. Copy the compiler to a fixed path and run an entry that requires a raw
 *    TypeScript package with no tsconfig, with a private `TTSC_CACHE_DIR`.
 * 2. Plant a marker in the one cached lowering and run again.
 * 3. Rewrite the compiler in place and run a third time.
 * 4. Assert the second run printed the marker and the third did not.
 */
export const test_ttsx_orphan_cache_misses_when_the_compiler_changes_at_the_same_path =
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

    fs.writeFileSync(compiler, fs.readFileSync(compiler));
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(compiler, later, later);
    const third = run();
    assert.equal(third.status, 0, third.stderr);
    assert.equal(third.stdout.trim(), "lowered");
  };

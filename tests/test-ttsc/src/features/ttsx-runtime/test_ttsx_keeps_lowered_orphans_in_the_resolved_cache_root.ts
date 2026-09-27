import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the lowered orphan sources live in the run's resolved cache root,
 * the one `--cache-dir` names or the default project-local one.
 *
 * The orphan cache read `TTSC_CACHE_DIR` alone: `ttsx --cache-dir` did not move
 * it, and without the variable it went to the system temporary directory, where
 * nothing collected or cleaned it (samchon/ttsc#1562). The run now names it in
 * its runtime manifest, under the root every other persistent part of the cache
 * uses.
 *
 * 1. Run an entry that requires a raw TypeScript package no project owns, with
 *    `--cache-dir`, and a private temporary directory.
 * 2. Run it again with neither `--cache-dir` nor `TTSC_CACHE_DIR`.
 * 3. Assert the first lowering is under the named root, the second under the
 *    default project-local root, and nothing went to the temporary directory.
 */
export const test_ttsx_keeps_lowered_orphans_in_the_resolved_cache_root =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "orphan-root", private: true }),
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
    const temp = path.join(root, "temp");
    fs.mkdirSync(temp);
    const run = (args: string[]) =>
      TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...args, "src/main.ts"],
        {
          cwd: root,
          env: {
            TEMP: temp,
            TMP: temp,
            TMPDIR: temp,
            TTSC_CACHE_DIR: undefined,
          },
        },
      );
    const lowered = (directory: string): string[] =>
      fs.existsSync(directory)
        ? fs.readdirSync(directory).filter((name) => name.endsWith(".js"))
        : [];

    const named = path.join(root, "named-cache");
    const first = run(["--cache-dir", named]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "lowered");
    assert.equal(lowered(path.join(named, "ttsx-orphan")).length, 1);

    const second = run([]);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "lowered");
    assert.equal(
      lowered(path.join(root, "node_modules", ".cache", "ttsc", "ttsx-orphan"))
        .length,
      1,
    );
    assert.equal(
      fs.existsSync(path.join(temp, "ttsc-orphan")),
      false,
      "a lowering went to the temporary directory",
    );
  };

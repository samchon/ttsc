import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a built dependency's published `rootDir` is the physical spelling of
 * the source path it will be compared against.
 *
 * The dependency lane looks a served source up by mirroring
 * `path.relative(rootDir, source)` into the emit directory, and the source
 * arrives through `fs.realpathSync.native`. A `rootDir` the owning tsconfig
 * declares is joined but never resolved, so a `rootDir` that is itself a
 * symlinked directory makes the pair two spellings of one place:
 * `path.relative` answers `../sources/index.ts`, the exact-mirror lane is
 * dropped, and every served file of that dependency falls to the trailing-stem
 * matcher, which rescans the whole emit tree per file. The marker the build
 * publishes carries that spelling, so the state outlives the process that
 * wrote it.
 *
 * The run still produces the right file either way, so the marker is what makes
 * this observable: a `rootDir` equal to its own physical path is exactly the
 * property the lookup needs.
 *
 * 1. Install a dependency whose `rootDir` is `src`, a symlink to the real
 *    `sources` directory holding its entry.
 * 2. Run ttsx against an entry that requires it, then prints every dependency
 *    marker's `rootDir`.
 * 3. Assert the dependency ran and every published `rootDir` is its own
 *    physical path.
 */
export const test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/dep/package.json": JSON.stringify({
        name: "dep",
        version: "1.0.0",
        main: "src/index.ts",
      }),
      // `files` is taken verbatim by tsgo, so the emit mirrors the declared
      // `src` spelling whether or not the walker would have resolved a glob.
      "node_modules/dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        files: ["src/index.ts"],
      }),
      "node_modules/dep/sources/index.ts": `export const VALUE: string = "dep-value";\n`,
      // The entry reads the runtime manifest to find the shared dependency
      // cache, then reports the `rootDir` of every marker the run published.
      // The markers live under a per-process directory ttsx deletes when the
      // child exits, so the child is the only place they can be observed.
      "src/main.ts": [
        `declare function require<T = unknown>(name: string): T;`,
        `declare const process: { env: Record<string, string | undefined> };`,
        ``,
        `const dep = require<{ VALUE: string }>("dep");`,
        `const fs = require<{`,
        `  readFileSync(file: string, encoding: string): string;`,
        `  readdirSync(directory: string): string[];`,
        `}>("node:fs");`,
        `const path = require<{ join(...parts: string[]): string }>(`,
        `  "node:path",`,
        `);`,
        ``,
        `const manifest = JSON.parse(`,
        `  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST ?? "", "utf8"),`,
        `) as { depCacheDir: string };`,
        `const roots = fs`,
        `  .readdirSync(manifest.depCacheDir)`,
        `  .filter((name) => name.endsWith(".json"))`,
        `  .map(`,
        `    (name) =>`,
        `      (`,
        `        JSON.parse(`,
        `          fs.readFileSync(path.join(manifest.depCacheDir, name), "utf8"),`,
        `        ) as { rootDir: string }`,
        `      ).rootDir,`,
        `  );`,
        ``,
        `console.log("VALUE:" + dep.VALUE);`,
        `console.log("ROOTS:" + JSON.stringify(roots));`,
        ``,
      ].join("\n"),
    });
    try {
      fs.symlinkSync(
        path.join(root, "node_modules", "dep", "sources"),
        path.join(root, "node_modules", "dep", "src"),
        "junction",
      );
    } catch {
      // Without symlink permission the declared and physical spellings never
      // diverge, and the contract this pins cannot be exercised.
      return;
    }

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /VALUE:dep-value/);

    const line = result.stdout
      .split(/\r?\n/)
      .find((text) => text.startsWith("ROOTS:"));
    assert.notEqual(line, undefined, result.stdout);
    const roots = JSON.parse(line!.slice("ROOTS:".length)) as string[];
    assert.ok(
      roots.length !== 0,
      `the dependency lane published no build marker: ${result.stdout}`,
    );
    for (const published of roots) {
      assert.equal(
        fs.realpathSync.native(published),
        published,
        "a published dependency rootDir is not its own physical path, so the " +
          "exact-mirror lookup compares two spellings of one directory",
      );
    }
  };

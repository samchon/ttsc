import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: CommonJS __dirname resolves without configured
 * outDir.
 *
 * When no `outDir` is configured, ttsc emits next to the source files. ttsx
 * must still point `__dirname` at the source directory so relative paths work,
 * and must not leave any `.js` files on disk (the cache lives in the default
 * temp location, not alongside source).
 *
 * 1. Create a project without `outDir`.
 * 2. Run ttsx against the entry.
 * 3. Assert the file-relative read succeeds and no `.js` file was written
 *    alongside the source.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx without configured outDir reads the original parent-relative asset, reports its CommonJS dirname and must leave no adjacent main.js; native physical identity must equal the fixture source directory.
 * @evidence contracts/testing.md#independent-expectations Literal no-outdir-preserved bytes and native realpath of the independently authored src directory define the expected results; reading assets alone could pass through mirrored cache links, so actual dirname is asserted independently.
 * @evidence contracts/testing.md#distinguishing-cases This owns absent-outDir runtime output redirection and source-directory identity together; configured-outDir source identity and ESM source URL are checked in their surviving shared consumers.
 * @evidence contracts/testing.md#execution-ownership The named E2E entry invokes one real compiler-backed public launcher and CommonJS host; source fixture modules only supply input and an independently observable dirname.
 * @evidence contracts/e2e.md#necessary-boundary The actual compiler's no-outDir default must be redirected while Node serves the source filename; pure path projections cannot establish the resulting native dirname binding or absence of adjacent emit.
 * @evidence contracts/e2e.md#shared-execution One absent-outDir compiler profile and one host perform asset, identity and no-adjacent-output assertions together; changing to configured outDir would remove the compiler default being checked here.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One immutable fixture owns its source and parent asset; the synchronous launcher exits before TestProject cleanup, and no changed-source or cache-invalidation transition is reused.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status, exact asset literal and absent adjacent main.js remain; exact native source-directory identity strengthens the previously non-distinguishing asset-only oracle.
 */
export function test_runner_corpus_commonjs_dirname_resolves_without_configured_outdir() {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/node.d.ts": `
      declare const __dirname: string;
      declare function require(name: string): { readFileSync(file: string, encoding: string): string };
    `,
      "src/main.ts": `
      const fs = require("node:fs");
      console.log(fs.readFileSync(__dirname + "/../template/data.txt", "utf8"));
      console.log(__dirname);
    `,
      "template/data.txt": "no-outdir-preserved",
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.trim().split(/\r?\n/);
    assert.equal(lines[0], "no-outdir-preserved");
    assert.equal(lines.length, 2);
    assert.equal(fs.realpathSync.native(lines[1]!), fs.realpathSync.native(path.join(root, "src")));
    assert.equal(fs.existsSync(path.join(root, "src", "main.js")), false);
  }

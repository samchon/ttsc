import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies an out-of-`include` entry reached through a symlink still emits into
 * the cache, never beside its own source.
 *
 * The entry project sets `rootDir` and lists the entry, and tsgo compares the
 * two textually: `GetCommonSourceDirectory` takes `rootDir` verbatim and
 * `ContainsPath` is lexical. A file it decides is not under `rootDir` gets an
 * output path built from its own absolute source path rather than from `outDir`
 * — so a `rootDir` spelled physically against an entry spelled logically writes
 * `clear.js` next to `clear.ts`, in a directory the run never cleans up. A
 * symlinked root reproduces on every platform what `/var` versus `/private/var`
 * does on macOS and an 8.3 name does on Windows.
 *
 * 1. Build the project under a real directory and reach it through a symlink.
 * 2. Run ttsx on an entry the project's `include` excludes.
 * 3. Assert it ran and that the real source tree gained no emitted file.
 * @evidence contracts/testing.md#behavioral-verification Ttsx runs excluded clear.ts through a directory link when available, prints cleared world and must preserve the recursive emitted-looking source artifacts plus an empty project lib directory.
 * @evidence contracts/testing.md#independent-expectations The authored hello result is world; pre/post artifact lists and the literal empty outDir independently detect redirected emit escaping into source locations.
 * @evidence contracts/testing.md#distinguishing-cases Logical entry path versus physical rootDir induces the target mismatch. If link creation fails the case falls back to a physical run, so the symlink divergence is then untested.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_keeps_an_out_of_include_entry_emit_out_of_the_source_tree entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary The native compiler and runtime virtual layout must isolate actual emit despite path aliases. Direct path planning cannot detect real source-tree publication.
 * @evidence contracts/e2e.md#shared-execution One fixture, optional link and one host are prepared. There is no compiler install per file; the included hello source and excluded entry retain their owning preparations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks the real fixture. Finally removes only the sibling link using unlink/rmdir and catches failures, so an unremovable link may remain; it never recursively deletes through it.
 * @evidence contracts/e2e.md#preserved-coverage Original status/output, pre/post artifact paths and empty lib checks remain. The artifact walker excludes node_modules/lib and does not hash old file contents; the separate lib assertion covers that excluded output directory.
 */
export function test_ttsx_keeps_an_out_of_include_entry_emit_out_of_the_source_tree() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "symlinked-outside-include",
        version: "1.0.0",
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "lib",
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "src/index.ts": `export const hello = (): string => "world";\n`,
      "clear.ts": [
        `import { hello } from "./src/index";`,
        `console.log("cleared " + hello());`,
        "",
      ].join("\n"),
    });
    const link = path.join(path.dirname(root), `${path.basename(root)}-link`);
    try {
      fs.symlinkSync(root, link, "junction");
    } catch {
      // A platform or account without symlink permission cannot exercise the
      // divergence at all; the physical-path run below still has to be clean.
    }
    const entryRoot = fs.existsSync(link) ? link : root;
    try {
      const before = sourceTreeEmits(root);
      const run = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", entryRoot, path.join(entryRoot, "clear.ts")],
        { cwd: entryRoot },
      );
      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /cleared world/);
      assert.deepEqual(
        sourceTreeEmits(root),
        before,
        "the entry project emitted into the source tree",
      );
      assert.deepEqual(
        fs.existsSync(path.join(root, "lib"))
          ? fs.readdirSync(path.join(root, "lib")).sort()
          : [],
        [],
        "ttsx must not populate the project's outDir",
      );
    } finally {
      // Remove the link itself, never through it. A recursive delete that
      // followed a junction would take the real project with it.
      try {
        fs.unlinkSync(link);
      } catch {
        try {
          fs.rmdirSync(link);
        } catch {
          // A link that was never created, or that the platform will not let
          // go, is left in the system temp directory.
        }
      }
    }
  }

/** Every emitted-looking artifact anywhere under the real project root. */
function sourceTreeEmits(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "lib") continue;
        walk(location);
        continue;
      }
      if (/\.(?:js|mjs|cjs|d\.ts|js\.map)$/.test(entry.name)) {
        found.push(path.relative(root, location).replace(/\\/g, "/"));
      }
    }
  };
  walk(root);
  return found.sort();
}

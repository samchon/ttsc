import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies ttsx runs an out-of-`include` entry that shares its name with a file
 * the project build emitted, in a project that declares no `rootDir`.
 *
 * Pins samchon/ttsc#1382 rows 3 and 4. With no `rootDir`, the project's own
 * directory is the source root, so `scripts/index.ts` sits inside it although
 * `include` names only `src`. The entry gate asked only whether the entry was
 * under that root, then let the lookup score `src/index.js` by its shared
 * `index` name, and ttsx ran the wrong program with exit status 0 — the
 * out-of-`include` lane (#1070) that compiles such an entry never ran. The
 * existing out-of-`include` case declares `rootDir: "src"`, which is exactly
 * the layout that hid this.
 *
 * 1. Create a project with `include: ["src"]`, no `rootDir`, and both
 *    `src/index.ts` and `scripts/index.ts`.
 * 2. Run `scripts/index.ts` through ttsx and through the `ttsc/register`
 *    preload, then run `src/index.ts` through ttsx.
 * 3. Assert each run prints its own file's marker.
 */
export const test_ttsx_runs_an_out_of_include_entry_that_shares_a_name_with_an_emitted_file =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "no-root-dir", private: true }),
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
      "src/index.ts": `console.log("ran src/index.ts");\nexport {};\n`,
      "scripts/index.ts": `console.log("ran scripts/index.ts");\nexport {};\n`,
    });
    linkTtscPackage(root);

    const script = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "scripts/index.ts"],
      { cwd: root },
    );
    assert.equal(script.status, 0, script.stderr);
    assert.equal(script.stdout.trim(), "ran scripts/index.ts");

    const registered = TestProject.spawn(
      process.execPath,
      ["--require", TTSX_REGISTER, "scripts/index.ts"],
      { cwd: root },
    );
    assert.equal(registered.status, 0, registered.stderr);
    assert.equal(registered.stdout.trim(), "ran scripts/index.ts");

    const source = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/index.ts"],
      { cwd: root },
    );
    assert.equal(source.status, 0, source.stderr);
    assert.equal(source.stdout.trim(), "ran src/index.ts");
  };

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies ttsx runs a required source its checked build never compiled from
 * that source's own code, not from a same-named emitted file.
 *
 * Pins samchon/ttsc#1382 rows 1 and 2. The project's `files` lists only
 * `entry/index.ts`, and the entry requires `../other/index.ts`. A `require`
 * call does not pull a file into the program, so the build emits
 * `entry/index.js` alone. The lookup used to score emitted files by shared
 * trailing path segments, and `index` was enough: `other/index.ts` ran the
 * entry's emitted code and reported itself as `entry`, with exit status 0.
 * Ownership is now proven by filesystem identity, and a file no build compiled
 * is compiled through its own project before it runs.
 *
 * 1. Create a project whose `files` names `entry/index.ts`, which requires the
 *    unlisted `other/index.ts`.
 * 2. Run the entry through ttsx and through the `ttsc/register` preload.
 * 3. Assert both run `other/index.ts` itself, and that no synthesized tsconfig is
 *    left beside the project's own.
 */
export const test_ttsx_runs_a_required_source_outside_the_checked_file_set_from_its_own_code =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "outside-files", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: ".",
          outDir: "dist",
          types: [],
        },
        files: ["entry/index.ts"],
      }),
      "entry/index.ts": [
        `declare const require: (path: string) => { identity: string };`,
        `export const identity: string = "entry";`,
        `const other = require("../other/index.ts");`,
        `console.log("other=" + other.identity);`,
        ``,
      ].join("\n"),
      "other/index.ts": `export const identity: string = "other";\n`,
    });
    linkTtscPackage(root);

    const direct = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "entry/index.ts"],
      { cwd: root },
    );
    assert.equal(direct.status, 0, direct.stderr);
    assert.equal(direct.stdout.trim(), "other=other");

    const registered = TestProject.spawn(
      process.execPath,
      ["--require", TTSX_REGISTER, "entry/index.ts"],
      { cwd: root },
    );
    assert.equal(registered.status, 0, registered.stderr);
    assert.equal(registered.stdout.trim(), "other=other");

    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith(".ttsx-")),
      [],
    );
  };

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
 * @evidence contracts/testing.md#behavioral-verification Requires other/index from a files-only entry/index through ttsx and public register, requiring other=other and no leftover .ttsx- root names.
 * @evidence contracts/testing.md#independent-expectations The two authored same-basename sources carry distinct values, independently detecting selection of the checked entry instead of required source.
 * @evidence contracts/testing.md#distinguishing-cases Both launch routes must load the omitted source; cleanup inspects only root entries with the .ttsx- prefix.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_a_required_source_outside_the_checked_file_set_from_its_own_code at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Two actual Node/native routes connect public register and ttsx to source-specific fallback emission.
 * @evidence contracts/e2e.md#shared-execution One project and installed register package are shared, while the two fresh hosts preserve distinct launch lifetimes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Package linking and source inputs are fixture-owned; both synchronous children finish before the root-prefix cleanup check.
 * @evidence contracts/e2e.md#preserved-coverage Both exact other=other outputs and the existing prefix cleanup assertion remain here without claiming complete cache-directory inspection.
 */
export function test_ttsx_runs_a_required_source_outside_the_checked_file_set_from_its_own_code() {
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
  }

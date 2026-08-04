import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies an entry outside the project's `include` takes its module format
 * from that project rather than from a default.
 *
 * "ttsx targets the tsconfig" is the whole contract for an excluded entry, and
 * the module option is the part of it with a consequence the run can show:
 * under the project's `nodenext` the package's missing `"type"` makes this a
 * CommonJS module and Node hands it `__dirname`. A synthesized entry project
 * that dropped the option would derive the kind from `target` instead, emit an
 * ES module, and print `esm` — so the two answers are distinguishable at run
 * time rather than merely asserted.
 *
 * Two options are deliberately not pinned here. `strict` cannot be, because
 * dropping it only makes a program compile that otherwise would not: its
 * inheritance is proved by the twin case, whose entry fails on an error
 * `strict` alone produces. `paths` cannot be either — it is a compile-time
 * mapping tsgo does not rewrite into the emit, so no ttsx entry resolves an
 * alias at run time, inside `include` or outside it.
 *
 * 1. Create a CommonJS-package project with `module: "nodenext"` and `include:
 *    ["src"]`.
 * 2. Run ttsx against a root-level script that reads `__dirname`.
 * 3. Assert it ran and reported `cjs`.
 */
export const test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "excluded-entry",
        version: "1.0.0",
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/index.ts": `export const hello = (): string => "world";\n`,
      // `value` is only well-typed because the project turns `strict` on: under
      // `strictNullChecks` the guard narrows it, and without the project's
      // options the entry would either compile differently or not at all.
      "clear.ts": [
        `declare const __dirname: string;`,
        ``,
        `const value: string | undefined = "aliased";`,
        `if (value === undefined) throw new Error("unreachable");`,
        `const narrowed: string = value;`,
        ``,
        `console.log(narrowed, typeof __dirname === "string" ? "cjs" : "esm");`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "clear.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "aliased cjs");
  };

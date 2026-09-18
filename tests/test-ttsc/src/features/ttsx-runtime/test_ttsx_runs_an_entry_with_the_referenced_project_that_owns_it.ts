import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies ttsx runs each file of a solution-style layout with the options of
 * the referenced project that contains it.
 *
 * Pins samchon/ttsc#1406. The root `tsconfig.json` of a Vite-shaped project
 * owns no files and delegates them through `references`. Discovery stopped at
 * that config and compiled the entry through the out-of-`include` lane with its
 * empty options, so a legacy decorator ran with standard semantics and exit
 * status 0, while the editor, following the references, showed nothing wrong.
 * The decorator's argument count makes the chosen project observable:
 * `experimentalDecorators` passes three arguments to a method decorator, and
 * standard decorators pass two.
 *
 * 1. Create a solution config referencing `tsconfig.app.json`, which enables
 *    `experimentalDecorators` for `src`, and `tsconfig.node.json`, which leaves
 *    it off for `vite.config.ts`. Add `scripts/loose.ts`, which no project
 *    contains.
 * 2. Run `src/main.ts` through ttsx and `ttsc/register`, then run
 *    `vite.config.ts` and `scripts/loose.ts` through ttsx.
 * 3. Assert the entry sees three arguments in both lanes, the config sees two,
 *    and the loose script still runs.
 */
export const test_ttsx_runs_an_entry_with_the_referenced_project_that_owns_it =
  () => {
    const probe = [
      `let observed: number = 0;`,
      `function probe(...args: any[]): void {`,
      `  observed = args.length;`,
      `}`,
      `class Box {`,
      `  @probe`,
      `  method(): void {}`,
      `}`,
      `new Box();`,
      `console.log("arguments=" + observed);`,
      `export {};`,
      ``,
    ].join("\n");
    const options = {
      target: "ES2022",
      module: "commonjs",
      strict: true,
      types: [],
    };
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "solution", private: true }),
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [
          { path: "./tsconfig.app.json" },
          { path: "./tsconfig.node.json" },
        ],
      }),
      "tsconfig.app.json": JSON.stringify({
        compilerOptions: { ...options, experimentalDecorators: true },
        include: ["src"],
      }),
      "tsconfig.node.json": JSON.stringify({
        compilerOptions: options,
        include: ["vite.config.ts"],
      }),
      "src/main.ts": probe,
      "vite.config.ts": probe,
      "scripts/loose.ts": `console.log("loose ran");\nexport {};\n`,
    });
    linkTtscPackage(root);

    for (const [label, command, args, expected] of [
      ["entry", TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], "arguments=3"],
      [
        "register",
        process.execPath,
        ["--require", TTSX_REGISTER, "src/main.ts"],
        "arguments=3",
      ],
      [
        "node config",
        TestProject.TTSX_BIN,
        ["--cwd", root, "vite.config.ts"],
        "arguments=2",
      ],
      [
        "uncontained",
        TestProject.TTSX_BIN,
        ["--cwd", root, "scripts/loose.ts"],
        "loose ran",
      ],
    ] as const) {
      const result = TestProject.spawn(command, [...args], { cwd: root });
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), expected, label);
    }
  };

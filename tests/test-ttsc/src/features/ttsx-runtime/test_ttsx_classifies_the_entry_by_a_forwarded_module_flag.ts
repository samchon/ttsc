import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx serves the entry project in the module format a forwarded
 * `--module` gave its emit.
 *
 * The runtime classifies each served file as CommonJS or an ES module by the
 * options its build emitted with. It read the config alone, so `ttsx --module
 * esnext` on a CommonJS project emitted ESM that the runtime then served as
 * CommonJS: Node's loader evaluated nothing and the run exited 0 without a line
 * of output. The forwarded flag decides the emit, so it decides the
 * classification too, for a project entry and for one outside `include`.
 *
 * 1. Create a CommonJS project whose entry imports a sibling, and an entry outside
 *    `include`.
 * 2. Run each entry with `--module esnext` and with `--module preserve`.
 * 3. Assert every run prints the imported value.
 */
export const test_ttsx_classifies_the_entry_by_a_forwarded_module_flag = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "moduleflag", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        types: [],
      },
      include: ["src"],
    }),
    "src/helper.ts": `export const helper = (): string => "helped";\n`,
    "src/main.ts": [
      `import { helper } from "./helper";`,
      `console.log("inside " + helper());`,
      ``,
    ].join("\n"),
    "outside.ts": [
      `import { helper } from "./src/helper";`,
      `console.log("outside " + helper());`,
      ``,
    ].join("\n"),
  });

  for (const module of ["esnext", "preserve"]) {
    for (const [entry, expected] of [
      ["src/main.ts", "inside helped"],
      ["outside.ts", "outside helped"],
    ] as const) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "--module", module, entry],
        { cwd: root },
      );
      assert.equal(result.status, 0, `${module} ${entry}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), expected, `${module} ${entry}`);
    }
  }
};

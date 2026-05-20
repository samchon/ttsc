import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs an .mts entry and resolves emitted .mjs imports.
 *
 * In a `NodeNext` module project, `.mts` files are compiled to `.mjs`. The
 * source uses `.mjs` in import specifiers (as required by TypeScript). ttsx
 * must not transform those specifiers since they already carry the correct
 * emitted extension.
 *
 * 1. Create a `NodeNext` project with `.mts` source files using `.mjs` imports.
 * 2. Run ttsx against the `.mts` entry.
 * 3. Assert the process exits successfully and the import resolved correctly.
 */
export const test_ttsx_runs_an_mts_entry_and_resolves_emitted_mjs_imports =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/helper.mts": `export const message: string = "mts-runner-ok";\n`,
      "src/main.mts": `import { message } from "./helper.mjs";\nconsole.log(message);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.mts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "mts-runner-ok");
  };

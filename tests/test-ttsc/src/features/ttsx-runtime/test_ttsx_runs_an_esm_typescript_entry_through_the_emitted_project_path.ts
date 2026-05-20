import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs an ESM TypeScript entry through the emitted project path.
 *
 * ESM projects use dynamic `import()` rather than `require()`. ttsx must
 * compile the project, rewrite extension-less import specifiers to include
 * `.js`, and then execute the emitted entry via `import()`. A failure here
 * indicates a regression in the ESM launcher path.
 *
 * 1. Create a `type: "module"` project with an entry that imports a helper.
 * 2. Run ttsx against the entry.
 * 3. Assert the process exits successfully and prints the expected output.
 */
export const test_ttsx_runs_an_esm_typescript_entry_through_the_emitted_project_path =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/helper.ts": `export const message: string = "esm-runner-ok";\n`,
      "src/main.ts": `import { message } from "./helper";\nconsole.log(message);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "esm-runner-ok");
  };

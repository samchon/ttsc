import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a CommonJS TypeScript entry through ttsc.
 *
 * Smoke test for the basic CJS ttsx path: compile the entry with ttsc, then
 * execute the resulting `.js` via Node's `require()`. A failure here indicates
 * a regression in the core launcher pipeline before any advanced features are
 * exercised.
 *
 * 1. Create a minimal CJS TypeScript project.
 * 2. Run ttsx against the entry.
 * 3. Assert the process exits successfully and prints the expected output.
 */
export const test_ttsx_runs_a_commonjs_typescript_entry_through_ttsc = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `const message: string = "runner-ok";\nconsole.log(message);\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "runner-ok");
};

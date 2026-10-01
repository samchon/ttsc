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
 * @evidence contracts/testing.md#behavioral-verification Runs main.mts importing ./helper.mjs backed by helper.mts and requires mts-runner-ok.
 * @evidence contracts/testing.md#independent-expectations The authored helper value independently proves the imported runtime module resolved and executed.
 * @evidence contracts/testing.md#distinguishing-cases NodeNext MTS emission must preserve the executable MJS import connection; no negative suffix case is asserted.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_an_mts_entry_and_resolves_emitted_mjs_imports at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual native extension emission and Node ESM resolution cross the MTS-to-MJS compiler/runtime boundary.
 * @evidence contracts/e2e.md#shared-execution One immutable ESM project and one host reuse installed compiler preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Package type, configs and source files remain fixed for the synchronous host; tracked cleanup occurs at process exit.
 * @evidence contracts/e2e.md#preserved-coverage The exact mts-runner-ok output remains here without claiming parser/classification units execute the MJS import.
 */
export function test_ttsx_runs_an_mts_entry_and_resolves_emitted_mjs_imports() {
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
  }

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a project with allowImportingTsExtensions.
 *
 * `ttsx` forces a runtime emit even when the user config is valid for no-emit
 * checking. Projects that import `./x.ts` need TypeScript-Go to rewrite those
 * specifiers in the cached JavaScript, otherwise TS5096 stops the runner before
 * the entry can execute.
 *
 * 1. Create an ESM project with `allowImportingTsExtensions` and a `.ts` import.
 * 2. Run ttsx against the entry.
 * 3. Assert the process exits successfully and prints the helper output.
 * @evidence contracts/testing.md#behavioral-verification Runs an ESM project allowing TypeScript extensions whose main imports ./helper.ts and requires allow-ts-extension-ok.
 * @evidence contracts/testing.md#independent-expectations The authored helper value independently establishes successful import and execution.
 * @evidence contracts/testing.md#distinguishing-cases Explicit .ts import syntax must survive the compiler/runtime handoff under the project option; no rejection control is present.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_allow_importing_ts_extensions_project at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual force-emit behavior and Node emitted-import handling connect the compiler option to executable ESM.
 * @evidence contracts/e2e.md#shared-execution One immutable project and one host reuse installed native compiler preparation without a source-plugin producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Project configuration, package type and sources stay fixed through the synchronous child and harness-owned process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The exact ESM output remains here; a parsed allowImportingTsExtensions flag alone does not verify executable imports.
 */
export function test_ttsx_runs_allow_importing_ts_extensions_project() {
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
        allowImportingTsExtensions: true,
      },
      include: ["src"],
    }),
    "src/helper.ts": `export const message: string = "allow-ts-extension-ok";\n`,
    "src/main.ts": `import { message } from "./helper.ts";\nconsole.log(message);\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    {
      cwd: root,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "allow-ts-extension-ok");
}

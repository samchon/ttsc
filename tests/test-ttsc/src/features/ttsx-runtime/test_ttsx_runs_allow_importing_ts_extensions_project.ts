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
 */
export const test_ttsx_runs_allow_importing_ts_extensions_project = () => {
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
};

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies runner corpus: nested entry discovers nearest package tsconfig.
 *
 * In a monorepo the entry file may live several levels below the workspace
 * root. ttsx must walk up from the entry file and use the nearest
 * `tsconfig.json` it finds, not a root-level one, so each package is compiled
 * with its own configuration.
 *
 * 1. Create a workspace with a tsconfig only under `packages/app/`.
 * 2. Run ttsx from the workspace root with an entry path of
 *    `packages/app/src/main.ts`.
 * 3. Assert compilation succeeds using the package-local tsconfig.
 */
export const test_runner_corpus_nested_entry_discovers_nearest_package_tsconfig =
  () => {
    const root = TestProject.createProject({
      "packages/app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "packages/app/src/main.ts": `const message: string = "nested-tsconfig-ok";\nconsole.log(message);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "packages/app/src/main.ts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "nested-tsconfig-ok");
  };

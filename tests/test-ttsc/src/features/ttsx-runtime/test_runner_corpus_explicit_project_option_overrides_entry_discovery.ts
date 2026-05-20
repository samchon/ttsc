import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies runner corpus: explicit project option overrides entry discovery.
 *
 * By default ttsx finds a tsconfig by walking up from the entry file. When
 * `--project` is passed, that discovery must be skipped and the specified
 * tsconfig must be used instead. This allows projects with non-standard
 * tsconfig locations (e.g. under `configs/`) to run without root-level tsconfig
 * files.
 *
 * 1. Create a project whose tsconfig lives under `configs/app.json`.
 * 2. Run ttsx with `--project configs/app.json`.
 * 3. Assert compilation succeeds and the output is correct.
 */
export const test_runner_corpus_explicit_project_option_overrides_entry_discovery =
  () => {
    const root = TestProject.createProject({
      "configs/app.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "../dist",
          rootDir: "../src",
        },
        include: ["../src"],
      }),
      "src/main.ts": `const message: string = "explicit-runner-project";\nconsole.log(message);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "--project", "configs/app.json", "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "explicit-runner-project");
  };

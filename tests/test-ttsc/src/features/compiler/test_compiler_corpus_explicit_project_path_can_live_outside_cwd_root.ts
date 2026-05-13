import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "explicit project path can live outside cwd root",
  root: () =>
    createProject({
      "configs/tsconfig.app.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "../dist/app",
          rootDir: "../src",
        },
        include: ["../src"],
      }),
      "src/main.ts": `export const message: string = "explicit-project";\nconsole.log(message);\n`,
    }),
  run(root: string) {
    const result = spawn(
      ttscBin,
      ["--cwd", root, "--project", "configs/tsconfig.app.json", "--emit"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs
        .readFileSync(path.join(root, "dist", "app", "main.js"), "utf8")
        .includes("explicit-project"),
      true,
    );
  },
};

/**
 * Verifies compiler corpus: explicit project path can live outside cwd root.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_explicit_project_path_can_live_outside_cwd_root =
  (): void => {
    const root = project.root();
    project.run(root);
  };

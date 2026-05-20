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
 * Verifies compiler corpus: `--project` can point to a tsconfig outside the
 * `--cwd` root.
 *
 * When `--project` is a relative path like `configs/tsconfig.app.json` and the
 * tsconfig's `include` and `rootDir` reference `../src`, the Go compiler must
 * resolve those paths relative to the tsconfig file, not the working directory.
 * Pins the cross-root resolution so monorepo setups that co-locate config files
 * separately from source compile correctly.
 *
 * 1. Create a project with `configs/tsconfig.app.json` that points `rootDir` at
 *    `../src`.
 * 2. Run `ttsc --project configs/tsconfig.app.json --emit`.
 * 3. Assert `dist/app/main.js` is written and contains the expected identifier.
 */
export const test_compiler_corpus_explicit_project_path_can_live_outside_cwd_root =
  (): void => {
    const root = project.root();
    project.run(root);
  };

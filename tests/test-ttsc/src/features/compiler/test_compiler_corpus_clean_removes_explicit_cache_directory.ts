import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "clean removes explicit cache directory",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value = "clean-cache-dir";\n`,
    }),
  run(root: string) {
    const cacheDir = path.join(root, ".custom-ttsc-cache");
    fs.mkdirSync(path.join(cacheDir, "plugins", "a"), { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, "plugins", "a", "plugin"),
      "binary",
      "utf8",
    );

    const result = spawn(
      ttscBin,
      ["clean", "--cwd", root, "--cache-dir", cacheDir],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /removed \.custom-ttsc-cache/);
    assert.equal(fs.existsSync(cacheDir), false);
  },
};

/**
 * Verifies compiler corpus: clean removes explicit cache directory.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_clean_removes_explicit_cache_directory =
  (): void => {
    const root = project.root();
    project.run(root);
  };

import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies compiler corpus: single-file mode honors tsconfig noEmit without
 * outDir.
 *
 * Without an `outDir`, the compatibility lane's fallback would write a
 * JavaScript sibling beside the source. A resolved `noEmit` must suppress that
 * write, while explicit `--emit` retains the project lane's documented
 * override.
 *
 * 1. Materialize a no-emit project without an output directory.
 * 2. Run one positional file and assert its JavaScript sibling is absent.
 * 3. Repeat with `--emit` and assert the sibling is intentionally written.
 */
export const test_compiler_corpus_single_file_honors_tsconfig_noemit_without_outdir =
  (): void => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          noEmit: true,
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "src/main.ts": `export const value: number = 1;\n`,
    });
    const output = path.join(root, "src", "main.js");

    const suppressed = spawn(ttscBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
    });
    assert.equal(suppressed.status, 0, suppressed.stderr);
    assert.equal(fs.existsSync(output), false);
    assert.equal(suppressed.stdout.includes("main.js"), false);

    const override = spawn(ttscBin, ["--cwd", root, "--emit", "src/main.ts"], {
      cwd: root,
    });
    assert.equal(override.status, 0, override.stderr);
    assert.equal(fs.existsSync(output), true);
  };

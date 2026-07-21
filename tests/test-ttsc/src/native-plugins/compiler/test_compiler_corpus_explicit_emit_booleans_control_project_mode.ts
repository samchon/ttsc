import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies compiler corpus: explicit emit booleans control project mode.
 *
 * The launcher consumes `--emit` and `--noEmit` before invoking the project
 * lane, so dropping an explicit `false` silently changes the build decision.
 * These twins prove both false forms remain meaningful after parsing.
 *
 * 1. Run `--emit=false` against a normally emitting project.
 * 2. Run `--noEmit=false` against a `noEmit` project.
 * 3. Assert the first writes nothing and the second explicitly restores output.
 */
export const test_compiler_corpus_explicit_emit_booleans_control_project_mode =
  (): void => {
    const disabledRoot = commonJsProject({
      "src/main.ts": `export const value: number = 1;\n`,
    });
    const disabled = spawn(ttscBin, ["--cwd", disabledRoot, "--emit=false"], {
      cwd: disabledRoot,
    });
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.equal(
      fs.existsSync(path.join(disabledRoot, "dist", "main.js")),
      false,
    );

    const enabledRoot = commonJsProject(
      {
        "src/main.ts": `export const value: number = 1;\n`,
      },
      { compilerOptions: { noEmit: true } },
    );
    const enabled = spawn(ttscBin, ["--cwd", enabledRoot, "--noEmit=false"], {
      cwd: enabledRoot,
    });
    assert.equal(enabled.status, 0, enabled.stderr);
    assert.equal(
      fs.existsSync(path.join(enabledRoot, "dist", "main.js")),
      true,
    );
  };

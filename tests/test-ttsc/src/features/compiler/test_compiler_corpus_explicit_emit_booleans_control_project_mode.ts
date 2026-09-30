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
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc with emit=false on an emitting project and noEmit=false on a noEmit project; checks both commands succeed, the former has no JavaScript and the latter produces it.
 * @evidence contracts/testing.md#independent-expectations Explicit false must retain its boolean meaning across launcher parsing and override project defaults. Opposite fixture defaults and literal absent/present output expectations detect truthiness-based parsing.
 * @evidence contracts/testing.md#distinguishing-cases Owns both false spellings against conflicting project defaults. Single-file boolean/noemit forms are owned by their separate entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_explicit_emit_booleans_control_project_mode is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary Argument parsing must propagate explicit booleans to real project compiler dispatch and output writing; parser-only tests do not prove this connection.
 * @evidence contracts/e2e.md#shared-execution Two commands need separate configured projects to contrast opposite defaults without stale output. Built launcher/native compiler preparation is shared and no plugin build occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each command writes into a unique fresh root, so enabled output cannot satisfy the disabled observation. Commands are synchronous and TestProject owns both roots until exit.
 * @evidence contracts/e2e.md#preserved-coverage Both success statuses and opposing JavaScript absence/presence checks remain in this twin scenario; neither case was consolidated away.
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

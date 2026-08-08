import type { IRunResult } from "../internal/IRunResult";
import { runScript } from "../internal/runScript";
import { benchmarkRoot } from "../internal/suiteRoot";

/**
 * Verifies the command line still executes when launched as its own entry.
 *
 * The module ends in a guard so importing it never starts a run, and the guard
 * is the single point where the whole benchmark either runs or silently does
 * not. `require.main` cannot answer it: `ttsx` loads every module through a
 * launcher that registers its runtime hooks, so `require.main` is that launcher
 * and `require.main === module` is false in every file it runs — the command
 * line would exit zero having done nothing, which no exit status distinguishes
 * from a completed run.
 *
 * So the case launches `pnpm start` exactly as an operator does and reads the
 * one thing only an executed `main` can produce: the argument parser's own
 * usage report. No arguments are passed, because the failure this locks is the
 * guard refusing to fire, and the parser rejects an empty argument list before
 * any workspace, engine, or model is touched.
 */
export const test_benchmark_command_line_runs_from_its_own_entry =
  async (): Promise<void> => {
    const result: IRunResult = runScript({
      cwd: benchmarkRoot,
      script: "start",
      timeout: 300_000,
    });
    if (result.output.includes("Usage: pnpm start codex")) return;
    throw new Error(
      `\`pnpm start\` must reach the benchmark command line's argument parser, but it never reported the usage it rejects an empty invocation with.

A run that produces no output here is the guard failing to recognize its own module as the entry: the process loads the command line, evaluates it, and exits without starting anything.

Command: pnpm run ${result.script}
Directory: ${result.cwd}
Exit status: ${String(result.status)}

Actual output:
${result.output}`,
    );
  };

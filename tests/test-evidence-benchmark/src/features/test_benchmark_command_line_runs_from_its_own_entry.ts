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
 *
 * 1. Invoke the benchmark package's start script with no arguments.
 * 2. Require its captured output to contain the parser's literal usage prefix.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual no-argument pnpm start output must contain Usage: pnpm start codex, rejecting a silently inactive entry guard.
 * @evidence contracts/testing.md#independent-expectations The literal user-facing parser usage prefix establishes the oracle independently of entry detection; captured status is diagnostic context and is not asserted.
 * @evidence contracts/testing.md#distinguishing-cases Empty arguments reach usage before workspace/engine/model setup; missing usage fails even with exit zero, while any matching substring is accepted.
 * @evidence contracts/testing.md#execution-ownership The matching features export runs via DynamicExecutor and runScript invokes the package's actual start entry through resolved pnpm.
 * @evidence contracts/e2e.md#necessary-boundary Pnpm dispatch, ttsx module loading and CLI guard must connect to parser output; calling main directly bypasses this boundary.
 * @evidence contracts/e2e.md#shared-execution One empty invocation requires no arm installation, archive pack, plugin build or official campaign; it shares script environment/cache ownership only.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity runScript sanitizes inherited runtime environment and waits for the synchronous child with its timeout. No measured cell or consumer edit is made; cache cleanup belongs to its owner.
 * @evidence contracts/e2e.md#preserved-coverage The original usage-substring assertion remains; exit status, complete usage text and actual campaign startup are not asserted.
 */
export const test_benchmark_command_line_runs_from_its_own_entry =
  async (): Promise<void> => {
    const result: IRunResult = runScript({
      cwd: benchmarkRoot,
      script: "start",
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

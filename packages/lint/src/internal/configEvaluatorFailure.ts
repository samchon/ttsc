export const CONFIG_EVALUATOR_MAX_BUFFER = 16 * 1024 * 1024;
export const CONFIG_EVALUATOR_STATUS_FD = 3;
export const CONFIG_EVALUATOR_PROCESS_OPTIONS = Object.freeze({
  killSignal: "SIGKILL" as const,
  maxBuffer: CONFIG_EVALUATOR_MAX_BUFFER,
});

interface ConfigEvaluatorProcessResult {
  error?: Error;
  output?: readonly (string | null)[] | null;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string | null | undefined;
}

/**
 * Classify the ways the isolated lint-config evaluator can stop.
 *
 * Node reports max-buffer termination with the configured signal, so the
 * process error code must take precedence over the signal. The evaluator uses
 * `SIGKILL`: Node's synchronous process API otherwise keeps waiting when a
 * POSIX child handles the default `SIGTERM` without exiting. A bare signal is
 * an external termination and a non-zero status is an evaluator failure whose
 * stderr tail contains the useful user-config diagnostic.
 *
 * There is deliberately no deadline. A config that takes a long time is a slow
 * build, which the user can see and interrupt; a config killed mid-evaluation
 * is a failed build with no output, which they cannot act on. The evaluator
 * runs the user's own code, and how long that code is allowed to take is not
 * the compiler's decision to make.
 */
export function configEvaluatorProcessFailure(
  result: ConfigEvaluatorProcessResult,
  configPath: string,
): Error | undefined {
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  const nestedCode = result.output?.[CONFIG_EVALUATOR_STATUS_FD]?.trim() ?? "";
  if (code === "ENOBUFS" || nestedCode === "ENOBUFS") {
    return new Error(
      `@ttsc/lint: ttsx evaluation of ${configPath} exceeded the ` +
        `${CONFIG_EVALUATOR_MAX_BUFFER / (1024 * 1024)} MiB output limit. ` +
        "Reduce console output from the config and its dependencies.",
    );
  }
  if (result.error) {
    return new Error(
      `@ttsc/lint: failed to spawn ttsx for ${configPath}: ${result.error.message}`,
    );
  }
  if (result.signal) {
    return new Error(
      `@ttsc/lint: ttsx evaluation of ${configPath} was killed by signal ${result.signal}.`,
    );
  }
  if (result.status !== 0) {
    const reason = configEvaluatorFailureReason(result.stderr);
    return new Error(
      `@ttsc/lint: lint config ${configPath} evaluation failed with exit code ${String(result.status)}` +
        (reason === "" ? "" : "\n" + reason),
    );
  }
  return undefined;
}

/**
 * Pass the output bound and private status pipe through the `ttsx` wrapper to
 * the runtime child that actually executes the config. No deadline travels with
 * them; there is none.
 */
export function configEvaluatorBoundaryEnvironment(): NodeJS.ProcessEnv {
  return {
    TTSC_TTSX_EVALUATOR_MAX_BUFFER_BYTES: String(CONFIG_EVALUATOR_MAX_BUFFER),
    TTSC_TTSX_EVALUATOR_STATUS_FD: String(CONFIG_EVALUATOR_STATUS_FD),
  };
}

/**
 * Return the useful tail of evaluator stderr without turning an exception into
 * an unbounded duplicate of the already-forwarded child stream.
 */
function configEvaluatorFailureReason(
  stderr: string | null | undefined,
): string {
  const bounded = (stderr ?? "").slice(-CONFIG_EVALUATOR_REASON_MAX_CHARS);
  const lines = bounded
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
  return lines.slice(-CONFIG_EVALUATOR_REASON_LINES).join("\n");
}

const CONFIG_EVALUATOR_REASON_LINES = 5;
const CONFIG_EVALUATOR_REASON_MAX_CHARS = 8 * 1024;

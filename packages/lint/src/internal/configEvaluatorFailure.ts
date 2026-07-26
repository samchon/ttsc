export const CONFIG_EVALUATOR_MAX_BUFFER = 16 * 1024 * 1024;
export const CONFIG_EVALUATOR_TIMEOUT_MS = 60_000;

interface ConfigEvaluatorProcessResult {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string | null | undefined;
}

/**
 * Classify the ways the isolated lint-config evaluator can stop.
 *
 * Node reports both timeout and max-buffer termination with `SIGTERM`, so the
 * process error code must take precedence over the signal. A bare signal is an
 * external termination and a non-zero status is an evaluator failure whose
 * stderr tail contains the useful user-config diagnostic.
 */
export function configEvaluatorProcessFailure(
  result: ConfigEvaluatorProcessResult,
  configPath: string,
): Error | undefined {
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ETIMEDOUT") {
    return new Error(
      `@ttsc/lint: ttsx evaluation of ${configPath} timed out after ` +
        `${CONFIG_EVALUATOR_TIMEOUT_MS / 1_000} seconds. ` +
        "Simplify the config or move heavy work out of top-level.",
    );
  }
  if (code === "ENOBUFS") {
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
 * Return the useful tail of evaluator stderr without turning an exception into
 * an unbounded duplicate of the already-forwarded child stream.
 */
function configEvaluatorFailureReason(
  stderr: string | null | undefined,
): string {
  const lines = (stderr ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
  return lines.slice(-CONFIG_EVALUATOR_REASON_LINES).join("\n");
}

const CONFIG_EVALUATOR_REASON_LINES = 5;

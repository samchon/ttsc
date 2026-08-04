interface ConfigEvaluatorProcessResult {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
}

/**
 * Classify the ways the isolated lint-config evaluator can stop.
 *
 * The evaluator writes the child's own output straight to this process's
 * stderr, so a diagnostic has already reached the user by the time anything
 * here runs. What is left to say is only how the process ended: it never
 * launched, something outside killed it, or it exited non-zero after printing
 * its own reason.
 *
 * Nothing is bounded here — not time, not output. Both were the compiler
 * deciding, on numbers nobody chose for this machine, that a user's own config
 * had run too long or said too much. A slow config is a slow build the user can
 * watch and interrupt; a loud one is output they asked for. Neither is this
 * process's memory to spend either, because the child's streams are no longer
 * collected into it.
 */
export function configEvaluatorProcessFailure(
  result: ConfigEvaluatorProcessResult,
  configPath: string,
): Error | undefined {
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
    return new Error(
      `@ttsc/lint: lint config ${configPath} evaluation failed with exit code ${String(result.status)}`,
    );
  }
  return undefined;
}

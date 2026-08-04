import fs from "node:fs";

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

/**
 * Read the failure envelope the evaluator writes to its result file when it
 * stops on an error it can name.
 *
 * This is the other half of classifying how the evaluation ended, which is why
 * it lives beside {@link configEvaluatorProcessFailure} rather than at the call
 * site: the status says that it failed, and this says why.
 *
 * Only a well-formed envelope is honoured. A real evaluation payload never
 * carries this key, and every other shape — an absent file, a build that failed
 * before the loader ran, a half-written result, a payload written before a
 * later non-zero exit — leaves the process status to speak for itself.
 */
export function configEvaluatorFailureReason(outputPath: string): string {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return "";
    const message = (parsed as { __ttscLoaderError?: unknown })
      .__ttscLoaderError;
    return typeof message === "string" ? message.trim() : "";
  } catch {
    return "";
  }
}

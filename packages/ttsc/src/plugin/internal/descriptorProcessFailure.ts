export const PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
export const PLUGIN_DESCRIPTOR_STATUS_FD = 3;
export const PLUGIN_DESCRIPTOR_PROCESS_OPTIONS = Object.freeze({
  killSignal: "SIGKILL" as const,
  maxBuffer: PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES,
});

interface DescriptorProcessResult {
  error?: Error;
  output?: readonly (string | null)[] | null;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string | null | undefined;
  stdout: string | null | undefined;
}

/**
 * Classify the ways the isolated TypeScript descriptor evaluator can stop.
 *
 * Node reports max-buffer termination with the configured signal, so the
 * process error code must take precedence over the signal. The evaluator uses
 * `SIGKILL`: Node's synchronous process API otherwise keeps waiting when a
 * POSIX child handles the default `SIGTERM` without exiting.
 *
 * There is deliberately no deadline. A descriptor that takes a long time is a
 * slow build, which the user can see and interrupt; a descriptor killed
 * mid-evaluation is a failed build with no output, which they cannot act on.
 */
export function pluginDescriptorProcessFailure(
  result: DescriptorProcessResult,
  request: string,
): Error | undefined {
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  const nestedCode = result.output?.[PLUGIN_DESCRIPTOR_STATUS_FD]?.trim() ?? "";
  if (code === "ENOBUFS" || nestedCode === "ENOBUFS") {
    return new Error(
      `ttsc: plugin descriptor "${request}" evaluation through ttsx exceeded the ` +
        `${PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES / (1024 * 1024)} MiB process output limit. ` +
        "Reduce stdout and stderr from the descriptor and its dependencies.",
    );
  }
  if (result.error) {
    return new Error(
      `ttsc: failed to launch ttsx for plugin descriptor "${request}": ${result.error.message}`,
    );
  }
  if (result.signal) {
    return new Error(
      `ttsc: plugin descriptor "${request}" evaluation through ttsx was killed by signal ${result.signal}.`,
    );
  }
  if (result.status !== 0) {
    const reason = descriptorFailureReason(
      hasText(result.stderr) ? result.stderr : result.stdout,
    );
    return new Error(
      `ttsc: plugin descriptor "${request}" evaluation through ttsx failed with exit code ${String(result.status)}` +
        (reason === "" ? "" : "\n" + reason),
    );
  }
  return undefined;
}

/**
 * Pass the output bound and private status pipe through the `ttsx` wrapper to
 * the runtime child that actually executes the descriptor.
 */
export function pluginDescriptorBoundaryEnvironment(): NodeJS.ProcessEnv {
  return {
    TTSC_TTSX_EVALUATOR_MAX_BUFFER_BYTES: String(
      PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES,
    ),
    TTSC_TTSX_EVALUATOR_STATUS_FD: String(PLUGIN_DESCRIPTOR_STATUS_FD),
  };
}

function hasText(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim() !== "";
}

function descriptorFailureReason(stderr: string | null | undefined): string {
  const bounded = (stderr ?? "").slice(-PLUGIN_DESCRIPTOR_REASON_MAX_CHARS);
  const lines = bounded
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
  return lines.slice(-PLUGIN_DESCRIPTOR_REASON_LINES).join("\n");
}

const PLUGIN_DESCRIPTOR_REASON_LINES = 5;
const PLUGIN_DESCRIPTOR_REASON_MAX_CHARS = 8 * 1024;

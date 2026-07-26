export const PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
export const PLUGIN_DESCRIPTOR_TIMEOUT_MS = 60_000;

interface DescriptorProcessResult {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string | null | undefined;
  stdout: string | null | undefined;
}

/**
 * Classify the ways the isolated TypeScript descriptor evaluator can stop.
 *
 * Node reports both timeout and max-buffer termination with `SIGTERM`, so the
 * process error code must take precedence over the signal.
 */
export function pluginDescriptorProcessFailure(
  result: DescriptorProcessResult,
  request: string,
): Error | undefined {
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ETIMEDOUT") {
    return new Error(
      `ttsc: plugin descriptor "${request}" evaluation through ttsx timed out after ` +
        `${PLUGIN_DESCRIPTOR_TIMEOUT_MS / 1_000} seconds. ` +
        "Descriptor modules and factories must finish their setup within that window.",
    );
  }
  if (code === "ENOBUFS") {
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

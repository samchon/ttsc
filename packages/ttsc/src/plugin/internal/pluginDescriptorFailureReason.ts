import fs from "node:fs";

/**
 * Read the failure envelope the descriptor shim writes to its result file when
 * it stops on an error it can name.
 *
 * This is the other half of classifying how the evaluation ended, which is why
 * it lives beside {@link pluginDescriptorProcessFailure} rather than at the call
 * site: the status says that it failed, and this says why.
 *
 * Only a well-formed envelope is honoured. A real descriptor never carries this
 * key, and every other shape — an absent file, a shim that died before writing,
 * a half-written result, a descriptor written before a later non-zero exit —
 * leaves the process status to speak for itself.
 */
export function pluginDescriptorFailureReason(outputPath: string): string {
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

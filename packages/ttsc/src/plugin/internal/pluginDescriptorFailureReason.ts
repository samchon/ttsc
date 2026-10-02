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
 *
 * @evidence contracts/common.md#principled-implementation Parsing the named error-envelope field yields trimmed human context only for a string; unreadable or invalid output contributes no invented reason to the already-known process failure.
 * @evidence contracts/common.md#clear-and-simple-design One file adapter supplies failure context while the process classifier independently owns launch/signal/status interpretation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The reserved envelope key is a shim protocol field, not a known-error-text special case or retry that masks descriptor failure.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains accepted envelope and rejected partial/missing shapes, with separate purpose and failure paragraphs under the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The file text and parsed object are local to the call and released on return.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One synchronous read and one JSON.parse of the loader output file; there is no loop.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work It runs once per failed descriptor load, so no repeated work exists to share.
 * @evidence contracts/portability.md#os-neutral-implementation The loader output path is passed to fs.readFileSync exactly as given, and any read or parse failure yields an empty reason, so no separator, case or platform assumption is made.
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

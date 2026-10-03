import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscMissingProgramOutputError } from "../errors/TtscMissingProgramOutputError";

/**
 * Attempt one warning per supplied file spelling and generation/epoch when a
 * module is left untransformed.
 *
 * The condition is ordinary and the build continues, but it must never be
 * silent: a file the program does not contain keeps whatever plugin syntax it
 * carries, which can defer a missing plugin transformation to runtime. The
 * generation's nonfatal stderr channel names that condition without repeating
 * the same spelling per delivery. The typed error owns its message text; this
 * reporter appends a newline but does not enforce a one-line message.
 *
 * Epoch changes clear the old file population; undefined is the persistent
 * host's single reporting epoch. Recording precedes writing, so synchronous
 * stream failure propagates without removing the attempted key.
 *
 * @evidence contracts/common.md#principled-implementation A per-generation set and delivery epoch distinguish already-attempted spelling keys from a new pass; the typed missing-output error supplies message text without changing the host's continuation policy or certifying stream success.
 * @evidence contracts/common.md#clear-and-simple-design Epoch reset, membership suppression and stderr delivery form a single reporting responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The reporter forwards the typed continuation reason rather than manufacturing output or classifying a diagnostic substring; duplicate suppression follows the recorded generation/epoch key.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain pass/persistent suppression, caller-owned message text and recording before stream output without promising one line or successful delivery.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   The supplied file is an opaque suppression key; this reporter parses no
 *   native path, resolves no alias and selects no filesystem/backend policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Key lookup/insertion retains file-text cost; an unsuppressed attempt
 *   constructs and writes the full message plus newline. Epoch change clears
 *   prior entry references, while repeated keys skip message construction/IO.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The generation set suppresses repeated write attempts for the same supplied
 *   file spelling in one epoch; it does not deduplicate physical aliases.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The set grows with distinct file spellings and text in the current epoch,
 *   clears on epoch change and becomes collectible with the generation. Stderr
 *   owns buffered bytes/backpressure; no separate task or history is retained.
 */
export function reportMissingProgramOutput(
  /** Generation owning epoch and warning-key population. */
  cached: TtscCachedProjectTransform,
  /** Typed continuation context supplying an opaque file key and message. */
  error: TtscMissingProgramOutputError,
  /** Pass identity, or undefined for persistent generation reporting. */
  epoch: number | undefined,
): void {
  const reported = (cached.missingOutputReported ??= new Set<string>());
  if (cached.missingOutputEpoch !== epoch) {
    cached.missingOutputEpoch = epoch;
    reported.clear();
  }
  if (reported.has(error.file)) {
    return;
  }
  reported.add(error.file);
  process.stderr.write(`${error.message}\n`);
}

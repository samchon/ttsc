import path from "node:path";

/**
 * Whether a descriptor declared the state of every file it read outside its
 * module graph, so an answer computed from its evaluation can be proven by what
 * the evaluation recorded.
 *
 * The declaration is `hostInputHashes`: a descriptor that returns it names each
 * file it read with the state it read it in, `{}` when it read none. Nothing
 * else can vouch for the reads a descriptor leaves out. Node's permission model
 * reports a read it would deny only through `--permission-audit`, which no Node
 * 22 release has; without it a denial the descriptor catches looks, to its
 * answer, like a file that is absent. An answer from a descriptor without the
 * declaration holds only for the evaluation that produced it.
 *
 * A `hostInputs` entry without a fingerprint is a declared input whose state
 * the descriptor could not prove, the way the protocol reports contradictory
 * observations, so it leaves the answer unproven too.
 *
 * @evidence contracts/common.md#principled-implementation A record-valued fingerprint declaration is required, including an explicit empty record for no external reads; every declared host input must have a resolved-path key before an evaluation can claim reproducibility.
 * @evidence contracts/common.md#clear-and-simple-design This predicate establishes the presence/completeness declaration only; fingerprint value validation and state proof remain with descriptor validation and cache readers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Undeclared reads do not gain cache eligibility through a guessed module graph or permission-model workaround; the producer must state its actual external input set.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains the explicit empty declaration, unsupported observation gap and missing-fingerprint refusal in distinct paragraphs under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation path.resolve compares native input spellings through the same host path semantics; this declaration checker does not require POSIX separators or use OS names to guess filesystem identity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Holds only references into the supplied descriptor during the call.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Inspects a fixed number of fields and makes one pass over the hostInputs array when it is present.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure shape check of one descriptor; there is no work to share between calls.
 */
export function declaresHostInputReads(descriptor: unknown): boolean {
  if (
    typeof descriptor !== "object" ||
    descriptor === null ||
    Array.isArray(descriptor)
  )
    return false;
  const { hostInputHashes, hostInputs } = descriptor as {
    hostInputHashes?: unknown;
    hostInputs?: unknown;
  };
  if (
    typeof hostInputHashes !== "object" ||
    hostInputHashes === null ||
    Array.isArray(hostInputHashes)
  )
    return false;
  if (hostInputs === undefined) return true;
  if (!Array.isArray(hostInputs)) return false;
  const fingerprinted = new Set(
    Object.keys(hostInputHashes).map((file) => path.resolve(file)),
  );
  return hostInputs.every(
    (input) =>
      typeof input === "string" && fingerprinted.has(path.resolve(input)),
  );
}

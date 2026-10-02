import path from "node:path";

/**
 * Whether a descriptor supplies a fingerprint-record declaration covering its
 * explicit hostInputs, by resolved native path keys.
 *
 * An explicit empty record declares no external reads. This shape/key predicate
 * cannot detect omitted reads or validate fingerprint values; producer honesty,
 * evaluator observations and cache proof acceptance remain separate premises.
 * A caught filesystem failure or the observed module graph alone cannot prove
 * the complete external input set.
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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The resolved-key Set and normalized path temporaries are call-local; no historical descriptor population, handle or cache lifecycle is owned.
 * @evidence contracts/performance.md#efficient-algorithms With explicit hostInputs, enumerable fingerprint keys are resolved into a Set and each supplied string is resolved for indexed membership. Key/input counts and complete path text, native normalization, property enumeration and ordinary descriptor accessor work drive cost; the explicit-inputs-absent case skips key materialization.
 * @evidence contracts/performance.md#reuse-equivalent-work The resolved-key Set is shared by membership checks within this descriptor, while no cross-request cache or reusable producer identity is owned here.
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

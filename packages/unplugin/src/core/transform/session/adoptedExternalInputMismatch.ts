import type { TtscSharedCompilePublication } from "./TtscSharedCompilePublication";

/**
 * The first external input whose state differs from what the publisher of an
 * adopted compile recorded, or `undefined` when both supplied maps agree
 * (samchon/ttsc#1390).
 *
 * The project walk's state names the publication, and the compiler's own graph
 * and host-input proofs carry compile-time state that any worker can check. A
 * dependency a plugin reports outside the project has neither: the only
 * evidence of what the compile read is the state the publisher recorded right
 * after compiling. An adopter's later reading cannot replace that recorded
 * state. This comparison requires equal own key sets and values for hashes and
 * realpath observations. Equality alone does not establish completeness,
 * compile-window stability or an unavailable physical identity; the
 * capture/adoption owner checks those.
 *
 * @param publication The adopted publication.
 * @param current This worker's external input snapshot of the same envelope.
 * @evidence contracts/common.md#principled-implementation Both recorded and current key sets and values must agree for content and physical identity; a missing input on either side refutes adoption.
 * @evidence contracts/common.md#clear-and-simple-design The same union-of-keys comparison handles the two proof dimensions and returns the first mismatched path without another snapshot layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An adopter's later reading is never treated as the publisher's compile-time state, and inherited object properties cannot masquerade as recorded inputs.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why external inputs need this separate proof and defines the first-mismatch result.
 * @evidence contracts/performance.md#efficient-algorithms Each reached dimension materializes both own-key arrays and their union before comparing values, so first mismatch does not avoid that dimension's key collection. Expected set work scales with key occurrences and their text; strict realpath comparison also depends on text length. Temporary arrays and the current union scale with that dimension's populations.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation compares supplied records without caching or coordinating observations. The caller captures current state and separately decides adoption; map equality does not certify completeness or compile-window validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The comparison borrows both snapshots and retains only local key sets; publication storage and generation lifetime belong to their owners.
 * @evidence contracts/portability.md#os-neutral-implementation Native input names and realpath observations are compared exactly as captured, including null observations. No case, separator or alias normalization guesses equivalence; differently represented observations conservatively mismatch. Current completeness and usable physical identity remain capture-owner obligations.
 */
export function adoptedExternalInputMismatch(
  publication: TtscSharedCompilePublication,
  current: {
    hashes: Readonly<Record<string, string>>;
    realpaths: Readonly<Record<string, string | null>>;
  },
): string | undefined {
  for (const [recorded, adopted] of [
    [publication.externalInputHashes, current.hashes],
    [publication.externalInputRealpaths, current.realpaths],
  ] as const) {
    const paths = new Set([...Object.keys(recorded), ...Object.keys(adopted)]);
    for (const input of paths) {
      if (
        !Object.prototype.hasOwnProperty.call(recorded, input) ||
        !Object.prototype.hasOwnProperty.call(adopted, input) ||
        recorded[input] !== adopted[input]
      ) {
        return input;
      }
    }
  }
  return undefined;
}

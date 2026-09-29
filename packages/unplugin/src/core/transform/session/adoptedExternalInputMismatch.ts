import type { TtscSharedCompilePublication } from "./TtscSharedCompilePublication";

/**
 * The first external input whose state differs from what the publisher of an
 * adopted compile recorded, or `undefined` when every one matches
 * (samchon/ttsc#1390).
 *
 * The project walk's state names the publication, and the compiler's own graph
 * and host-input proofs carry compile-time state that any worker can check. A
 * dependency a plugin reports outside the project has neither: the only
 * evidence of what the compile read is the state the publisher recorded right
 * after compiling. An adopter's own reading, taken later, proves nothing about
 * that compile unless it equals the publisher's, path for path, in content and
 * in physical identity.
 *
 * @param publication The adopted publication.
 * @param current This worker's external input snapshot of the same envelope.
 *
 * @evidence contracts/common.md#principled-implementation Both recorded and current key sets and values must agree for content and physical identity; a missing input on either side refutes adoption.
 * @evidence contracts/common.md#clear-and-simple-design The same union-of-keys comparison handles the two proof dimensions and returns the first mismatched path without another snapshot layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An adopter's later reading is never treated as the publisher's compile-time state, and inherited object properties cannot masquerade as recorded inputs.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why external inputs need this separate proof and defines the first-mismatch result.
 * @evidence contracts/performance.md#efficient-algorithms Two unions of recorded/current keys compare content and physical identity in linear expected time and return at the first mismatch; temporary key sets grow with their respective external-input populations.
 * @evidence contracts/performance.md#reuse-equivalent-work The publisher's existing snapshots are reused as the comparison target, but the caller must supply a current observation; equality never retroactively proves bytes the publisher did not record.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The comparison borrows both snapshots and retains only local key sets; publication storage and generation lifetime belong to their owners.
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

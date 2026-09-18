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

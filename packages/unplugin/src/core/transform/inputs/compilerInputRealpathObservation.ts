import type { ITtscCompilerTransformation } from "ttsc";
import { resolveFilesystemPath } from "ttsc/path-identity";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Replay the compiler's realpath observation. An empty resolver result is
 * unsuccessful; a thrown native resolution uses the compiler's cleaned lexical
 * fallback instead of becoming a missing-input proof.
 *
 * @evidence contracts/common.md#principled-implementation Empty results and thrown resolution remain distinct because the compiler records an empty result as failed but cleans the input spelling on native resolution failure.
 * @evidence contracts/common.md#clear-and-simple-design One adapter maps resolver output into the envelope's realpath observation; identity comparison remains with its consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The lexical fallback reproduces the compiler filesystem contract rather than fabricating successful physical resolution for a known input.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes empty, successful and fallback results; a blank comment line separates acknowledgments under the documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral replay uses the supplied resolver and explicit path dialect through resolveFilesystemPath; the cleaned fallback does not claim native alias or case equivalence.
 */
export function compilerInputRealpathObservation(
  file: string,
  filesystem: TtscTransformFilesystemOperations,
): NonNullable<ITtscCompilerTransformation.IInputObservation["realpath"]> {
  try {
    const realpath = filesystem.realpath(file);
    return realpath.length === 0
      ? { ok: false }
      : {
          ok: true,
          path: resolveFilesystemPath(realpath, filesystem.platform),
        };
  } catch {
    // TypeScript-Go's OS and io filesystems return the cleaned input spelling
    // when native realpath resolution fails; they do not expose the failure.
    return {
      ok: true,
      path: resolveFilesystemPath(file, filesystem.platform),
    };
  }
}

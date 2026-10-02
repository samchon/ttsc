import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import { hashText } from "../utils/hashText";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";

/**
 * Digest one exact out-of-walk path's metadata, content state, physical target
 * and directory listing. Failed directory observation is distinct from a path
 * that is not a directory; this is a retry-change fingerprint, not a success
 * proof of an unreadable input.
 *
 * @evidence contracts/common.md#principled-implementation Metadata, host state, realpath and sorted entry-kind observations jointly represent exact-path changes; missing/unavailable states remain explicit in the serialized digest.
 * @evidence contracts/common.md#clear-and-simple-design Existing input helpers own metadata/content/identity reads; this operation composes them with directory membership into one compact terminal comparison value.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Observation failures cannot equal an invented valid directory state, and a retained failure fingerprint does not certify unreadable compiler input.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies fingerprint components, failed-directory distinctions and the difference between retry comparison and reusable-generation proof.
 * @evidence contracts/portability.md#os-neutral-implementation All native observations use the injected filesystem boundary and host helpers; directory entry classifications come from actual Dirent capabilities rather than suffix or OS-name guesses.
 * @evidence contracts/performance.md#efficient-algorithms Following kind, metadata, content and realpath observations each retain native path/access costs; helpers can reread metadata and resolve ancestors rather than making a fixed observation count a time bound. A directory's N entries are materialized, their name/kind text sorted and joined before hashing, with comparison/encoding costs driven by text bytes and O(N) listing/frame storage. Content hashing additionally reads available bytes; sorting removes enumeration-order effects, not observation failures.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This fresh observation fingerprint establishes a current comparison value; terminal environment validation owns metadata-first reuse and turn-shared verdicts.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only a digest transfers to the caller; this operation owns no historical input-state cache, native handle or watcher lifecycle.
 */
export function failedGenerationInputState(
  input: string,
  filesystem: TtscTransformFilesystemOperations,
): string {
  let directory = "not-directory";
  try {
    if (filesystem.stat(input).isDirectory()) {
      directory = hashText(
        filesystem
          .readdir(input)
          .map((entry) =>
            [
              entry.name,
              entry.isDirectory(),
              entry.isFile(),
              entry.isSymbolicLink(),
            ].join(":"),
          )
          .sort()
          .join("\0"),
      );
    }
  } catch {
    directory = "unavailable";
  }
  return hashText(
    JSON.stringify([
      inputMetadataSignature(input, filesystem) ?? "missing",
      hostInputStateHash(input, filesystem) ?? MISSING_INPUT_STATE,
      hostInputRealpath(input, filesystem),
      directory,
    ]),
  );
}

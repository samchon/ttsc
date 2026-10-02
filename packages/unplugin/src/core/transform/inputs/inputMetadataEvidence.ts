import { stampSeparable } from "../clock/stampSeparable";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscInputMetadataEvidence } from "./TtscInputMetadataEvidence";

/**
 * Observe lexical-link and target metadata together with clock separability.
 * An unavailable link target retains a missing-target signature and cannot
 * authorize notification-only or metadata-only reuse. Unavailable lexical
 * metadata returns undefined rather than representing a proven missing input.
 *
 * The caller must refresh the filesystem's device clock references before the
 * content read whose reuse is being proven; this observer does not mint them.
 *
 * @evidence contracts/common.md#principled-implementation Link and target identity, size and stamps capture different mutation paths; a missing target stays distinct, and both observed stamps must pass the same-device strict clock-separability predicate.
 * @evidence contracts/common.md#clear-and-simple-design One metadata record carries signature, notification authority and separability as independent facts; clock acquisition and later content-reuse decisions remain with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Symlinks and multiply linked files cannot acquire blanket watcher authority, and broken-link state is not rewritten into a lexical-parent missing-path proof.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state unavailable-target behavior, unavailable metadata and clock-reference ordering; separated tags and distinct member comments follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral evidence reads actual bigint device, inode, link count and nanosecond stamps through the supplied following/nonfollowing capabilities rather than assuming OS-wide clock precision or watcher coverage.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One lstat suffices for ordinary inputs; only symbolic links need a target
 *   stat. Fixed-field signatures and device lookups avoid file-byte reads while
 *   native path resolution and bigint formatting retain component/digit costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This captures the evidence consumed by reuse coordinators; it neither stores completed content work nor decides equivalence across deliveries.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The result holds primitive evidence only; device clock references belong to their filesystem owner and this function acquires no retained handle or task.
 */
export function inputMetadataEvidence(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): TtscInputMetadataEvidence | undefined {
  try {
    const link = filesystem.lstat(file);
    let target = link;
    if (link.isSymbolicLink()) {
      try {
        target = filesystem.statBigInt(file);
      } catch {
        // Keep a broken link in the existing-input manifest. Its own metadata
        // stays stable while the target is missing, and the first successful
        // stat after the target appears changes this signature. Treating it as
        // a plain missing path would watch/list only the link's parent, which
        // cannot observe a target created in another directory. It carries no
        // readable bytes, so it never needs to be separable.
        return {
          signature: [
            link.dev,
            link.ino,
            link.mode,
            link.size,
            link.mtimeNs,
            link.ctimeNs,
            "missing-target",
          ].join(":"),
          notificationAuthoritative: false,
          separable: false,
        };
      }
    }
    return {
      signature: [
        link.dev,
        link.ino,
        link.nlink,
        link.mode,
        link.size,
        link.mtimeNs,
        link.ctimeNs,
        target.dev,
        target.ino,
        target.nlink,
        target.mode,
        target.size,
        target.mtimeNs,
        target.ctimeNs,
      ].join(":"),

      // A write through a hardlink outside the watched tree changes this inode
      // without notifying either the original directory or a watcher opened on
      // the original path. Keep such files on metadata validation. Symlinks are
      // likewise governed by the target path, outside the lexical observer.
      notificationAuthoritative:
        !link.isSymbolicLink() &&
        !(link.isFile() && (link.nlink > 1n || target.nlink > 1n)),

      // Both halves must be separable: a write remints the target's stamp, a
      // link retarget the link's own, and either one hiding inside its recorded
      // tick would evade the skipped content and realpath comparisons.
      separable:
        stampSeparable(filesystem, link) && stampSeparable(filesystem, target),
    };
  } catch {
    return undefined;
  }
}

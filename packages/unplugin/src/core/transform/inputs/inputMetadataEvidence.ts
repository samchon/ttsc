import { stampSeparable } from "../clock/stampSeparable";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscInputMetadataEvidence } from "./TtscInputMetadataEvidence";

/** Observe one input's metadata signature and its clock separability. */
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

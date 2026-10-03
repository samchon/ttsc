import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";

/**
 * Write the language server's plugin manifest to a private file the Go host can
 * read.
 *
 * The file lives in its own canonical temporary directory, is created
 * exclusively with POSIX mode 0600. Windows access follows the temporary
 * directory's inherited ACL; that mode does not establish an ACL guarantee. The
 * native child consumes the file and `dispose` removes the directory after the
 * invocation. A failed disposal can be retried; forced termination can prevent
 * either cleanup owner from running.
 *
 * @evidence contracts/common.md#principled-implementation A unique canonical directory and exclusive file creation bind one serialized selection to one invocation; removal belongs to both the consuming child and the launcher's final disposal boundary.
 * @evidence contracts/common.md#clear-and-simple-design The returned path and disposer expose only the transport ownership needed by the launcher; serialization, acquisition and rollback stay together.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The real manifest is written through native filesystem APIs without environment-size truncation or a substituted payload; cleanup failure is reported rather than disguised as successful removal.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state POSIX permissions, Windows ACL limits, retry and forced-termination limits with separated acknowledgment tags following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Canonical temporary-directory creation and native path joining preserve OS-neutral paths; exclusive creation is portable but POSIX mode bits are explicitly distinguished from Windows ACLs.
 * @evidence contracts/performance.md#efficient-algorithms JSON serialization traverses supplied properties and can invoke caller conversion before native writing, so work is not bounded only by output bytes. Canonical parent checks/directory allocation, path construction and cleanup add native costs; one transport file uses no extra per-plugin filesystem artifact.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation owns a separate consumable file, so sharing a prior transport would violate lifetime and child consumption even if JSON matched.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One directory and file are owned by the returned disposer; acquisition rollback preserves both errors when removal also fails, and successful disposal marks completion only after removal so a failed cleanup remains retryable.
 */
export function materializeLSPPluginManifest(manifest: unknown): {
  dispose(): void;
  path: string;
} {
  const directory = createCanonicalTempDirectory("ttsc-lsp-");
  const location = path.join(directory, "plugins.json");
  try {
    fs.writeFileSync(location, JSON.stringify(manifest), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    try {
      fs.rmSync(directory, { force: true, recursive: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "ttscserver: manifest creation and cleanup failed",
      );
    }
    throw error;
  }
  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      fs.rmSync(directory, { force: true, recursive: true });
      disposed = true;
    },
    path: location,
  };
}

import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { LSPProjectInputDigest } from "./LSPProjectInputDigest";

/**
 * Take the fingerprints of every reload directory and reload file of a snapshot
 * at the moment the language server's plugin selection is made.
 *
 * Exported for the Windows parity test, which runs this module from Go to prove
 * both sides compute the same digest.
 */
export function fingerprintInitialLSPProjectInputSnapshot(
  snapshot: ITtscProjectInputSnapshot,
): LSPProjectInputDigest.InitialLSPProjectInputSnapshot {
  const reloadDirectoryDigests: Record<string, string> = {};
  const reloadFileDigests: Record<string, string> = {};
  for (const directory of snapshot.reloadDirectories ?? []) {
    reloadDirectoryDigests[directory] =
      LSPProjectInputDigest.lspProjectInputReloadDirectoryDigest(directory);
  }
  for (const file of snapshot.reloadFiles ?? []) {
    reloadFileDigests[file] = LSPProjectInputDigest.lspProjectInputFileDigest(
      LSPProjectInputDigest.realLSPProjectInputEntryPath(file),
    );
  }
  return {
    ...snapshot,
    reloadDirectoryDigests,
    reloadFileDigests,
  };
}

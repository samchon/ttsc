import { LSPProjectInputDigest } from "./LSPProjectInputDigest";

/**
 * Whether nothing a snapshot fingerprinted has changed since, so the plugin
 * selection made against it is still the one the project asks for.
 */
export function initialLSPProjectInputSnapshotIsCurrent(
  snapshot: LSPProjectInputDigest.InitialLSPProjectInputSnapshot,
): boolean {
  return (
    (snapshot.reloadDirectories ?? []).every(
      (directory) =>
        snapshot.reloadDirectoryDigests[directory] ===
        LSPProjectInputDigest.lspProjectInputReloadDirectoryDigest(directory),
    ) &&
    (snapshot.reloadFiles ?? []).every(
      (file) =>
        snapshot.reloadFileDigests[file] ===
        LSPProjectInputDigest.lspProjectInputFileDigest(LSPProjectInputDigest.realLSPProjectInputEntryPath(file)),
    )
  );
}

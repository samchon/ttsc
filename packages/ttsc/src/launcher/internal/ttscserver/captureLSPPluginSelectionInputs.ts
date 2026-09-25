import path from "node:path";

import { hashHostInputPaths } from "../../../plugin/internal/load/hashHostInputPaths";
import { GoSourceInputs } from "../../../plugin/internal/source/GoSourceInputs";
import { collectPluginSourceDirectories } from "../../../plugin/internal/source/collectPluginSourceDirectories";
import { collectPluginSourceFiles } from "../../../plugin/internal/source/collectPluginSourceFiles";
import { pluginSourceStateHolds } from "../../../plugin/internal/source/pluginSourceStateHolds";
import type { ILSPPluginSelectionInputs } from "./ILSPPluginSelectionInputs";
import { LSPProjectInputDigest } from "./LSPProjectInputDigest";

/**
 * The inputs a `ttscserver` session's plugin selection was loaded from, which
 * the native host watches for the life of the session, or `undefined` when one
 * of them no longer holds the state the load proved.
 *
 * A session runs the sidecar binaries and the capabilities one plugin load
 * resolved at startup. The load read the descriptors and the files they
 * resolved (`hostInputs`), and it built each binary from the Go sources of its
 * `pluginSources`; a change to any of them selects other plugins, or builds
 * another binary, which only a new session loads (samchon/ttsc#1507). The host
 * ends the session through its reload path when one changes, and the editor
 * starts the next. The shape each travels in is `ILSPPluginSelectionInputs`.
 *
 * Left out are the project's own configuration files, which the session already
 * hears as a Program refresh, and a plugin's `configFile` that no descriptor
 * read, which its plugin declares among its own project inputs.
 *
 * Everything is fingerprinted now, and then required to agree with what the
 * load proved: every input the load hashed still has that hash, and every
 * plugin source still holds the state its binary was keyed on. A change after
 * the load and before the fingerprint would otherwise be recorded as the state
 * the session was selected from.
 *
 * @param loaded The plugin load of the session.
 * @returns The inputs, or `undefined` when the load no longer describes the
 *   filesystem and the selection has to be loaded again.
 */
export function captureLSPPluginSelectionInputs(loaded: {
  deferredHostInputs: readonly string[];
  hostInputHashes: Readonly<Record<string, string | null>>;
  hostInputs: readonly string[];
  pluginSources: Readonly<Record<string, string>>;
  project: { configPaths: readonly string[] };
}): ILSPPluginSelectionInputs | undefined {
  const excluded = new Set(
    [...loaded.project.configPaths, ...loaded.deferredHostInputs].map((file) =>
      path.resolve(file),
    ),
  );
  const descriptorInputs = loaded.hostInputs
    .map((file) => path.resolve(file))
    .filter((file) => !excluded.has(file));
  const descriptorFiles: Record<string, Record<string, string>> = {};
  for (const file of descriptorInputs) record(descriptorFiles, file);
  const sourceFiles: Record<string, Record<string, string>> = {};
  for (const source of Object.keys(loaded.pluginSources)) {
    for (const directory of collectPluginSourceDirectories(source))
      sourceFiles[path.resolve(directory)] ??= {};
    for (const file of collectPluginSourceFiles(source))
      record(sourceFiles, path.resolve(file));
  }
  const proven = descriptorInputs.filter((file) =>
    Object.prototype.hasOwnProperty.call(loaded.hostInputHashes, file),
  );
  const current = hashHostInputPaths(proven);
  if (proven.some((file) => current[file] !== loaded.hostInputHashes[file]))
    return undefined;
  for (const [directory, state] of Object.entries(loaded.pluginSources))
    if (!pluginSourceStateHolds(directory, state)) return undefined;
  return {
    omittedNames: GoSourceInputs.OMITTED_SOURCE_FILE_NAMES,
    omittedSuffixes: GoSourceInputs.OMITTED_SOURCE_FILE_SUFFIXES,
    prunedDirectoryNames: GoSourceInputs.PRUNED_SOURCE_DIRECTORY_NAMES,
    descriptorFiles,
    sourceFiles,
  };
}

/** Record `file`'s digest under its directory. */
function record(
  directories: Record<string, Record<string, string>>,
  file: string,
): void {
  (directories[path.dirname(file)] ??= {})[path.basename(file)] =
    LSPProjectInputDigest.lspProjectInputFileDigest(file);
}

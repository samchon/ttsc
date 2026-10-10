import path from "node:path";

import { hashHostInputPaths } from "../../../plugin/internal/load/hashHostInputPaths";
import { realpathHostInputPaths } from "../../../plugin/internal/load/realpathHostInputPaths";
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
 * another binary, which only a new session loads. The host ends the session
 * through its reload path when one changes, and the editor starts the next. The
 * shape each travels in is `ILSPPluginSelectionInputs`.
 *
 * What selects the plugins is among them: the project's config chain, whose
 * `compilerOptions.plugins` names them, and the manifests plugin discovery
 * reads. A change there is a selection change, as `ttsc --watch` treats it,
 * rather than only a Program refresh. Left out is a plugin's `configFile` that
 * no descriptor read, which its plugin declares among its own project inputs.
 *
 * Non-deferred inputs are fingerprinted, then recorded content/target proofs
 * and plugin-source states are checked again. Only paths with a recorded proof
 * participate in that proof comparison. These sequential observations reject
 * detected drift; unavailable markers or changes between reads are not a proof
 * that the complete filesystem stayed fixed throughout capture.
 *
 * @param loaded The plugin load of the session, with the project whose plugin
 *   cache proves its plugin sources from records.
 * @returns The inputs, or `undefined` when the load no longer describes the
 *   filesystem and the selection has to be loaded again.
 * @evidence contracts/common.md#principled-implementation The manifest groups candidate/source-file digests by directory. Recorded content and physical-target proofs and all plugin-source states are compared again before return; a detected mismatch rejects capture, while sequential reads and unproven paths do not certify every post-load change.
 * @evidence contracts/common.md#clear-and-simple-design Candidate filtering, source enumeration and proof comparison remain separate; the private recorder owns basename insertion into prototype-free maps, including names such as __proto__.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source omission rules come from the binary builder's shared constants; stale proofs return undefined instead of replacing a loaded selection with guessed current evidence.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain selection versus program refresh, deferred config inputs and the startup race; parameter/result documentation and separated tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path operations retain declared spellings and actual realpath observations detect symlink or junction retargeting independently of content equality; no OS name supplies filesystem case policy.
 * @evidence contracts/performance.md#efficient-algorithms Path normalization/filtering allocates candidate arrays and an excluded set. Each source is walked for directories and again for files; file framing is followed by separate recorded content/realpath proof reads and plugin-source state validation, including its native/toolchain costs. Maps retain path keys and digests while temporary walk/read buffers coexist; directory grouping avoids repeating directory keys per file.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This capture validates a particular completed load against current filesystem state; retained plugin/binary reuse belongs to that load's owner, and cached post-load readings would miss drift.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned maps transfer to the session builder. Supported readers and source-state helpers own their native acquisition/release boundaries; this mapper stores no cross-call capture or running task, and local output has no independent population or byte ceiling.
 */
export function captureLSPPluginSelectionInputs(loaded: {
  deferredHostInputs: readonly string[];
  hostInputHashes: Readonly<Record<string, string | null>>;
  hostInputRealpaths: Readonly<Record<string, string | null>>;
  hostInputs: readonly string[];
  pluginSources: Readonly<Record<string, string>>;
  project?: { root: string };
}): ILSPPluginSelectionInputs | undefined {
  const excluded = new Set(
    loaded.deferredHostInputs.map((file) => path.resolve(file)),
  );
  const descriptorInputs = loaded.hostInputs
    .map((file) => path.resolve(file))
    .filter((file) => !excluded.has(file));
  const descriptorFiles: Record<string, Record<string, string>> = {};
  for (const file of descriptorInputs) record(descriptorFiles, file);
  const sourceFiles: Record<string, Record<string, string>> = {};
  for (const source of Object.keys(loaded.pluginSources)) {
    for (const directory of collectPluginSourceDirectories(source))
      sourceFiles[path.resolve(directory)] ??= Object.create(null);
    for (const file of collectPluginSourceFiles(source))
      record(sourceFiles, path.resolve(file));
  }
  const proven = descriptorInputs.filter((file) =>
    Object.prototype.hasOwnProperty.call(loaded.hostInputHashes, file),
  );
  const current = hashHostInputPaths(proven);
  if (proven.some((file) => current[file] !== loaded.hostInputHashes[file]))
    return undefined;
  const physicalInputs = descriptorInputs.filter((file) =>
    Object.prototype.hasOwnProperty.call(loaded.hostInputRealpaths, file),
  );
  const currentRealpaths = realpathHostInputPaths(physicalInputs);
  if (
    physicalInputs.some(
      (file) => currentRealpaths[file] !== loaded.hostInputRealpaths[file],
    )
  )
    return undefined;
  // The load's project names the plugin cache whose records prove the sources
  // and the SDK, so a session start does not read them again (#1725).
  for (const [directory, state] of Object.entries(loaded.pluginSources))
    if (
      !pluginSourceStateHolds(directory, state, {
        projectRoot: loaded.project?.root,
      })
    )
      return undefined;
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
  (directories[path.dirname(file)] ??= Object.create(null))[
    path.basename(file)
  ] = LSPProjectInputDigest.lspProjectInputFileDigest(file);
}

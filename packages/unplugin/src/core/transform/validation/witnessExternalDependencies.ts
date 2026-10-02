import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import type { TtscExternalDependencyWitness } from "./TtscExternalDependencyWitness";

/**
 * Read the state of plugin-reported dependency paths before a compile, keyed by
 * resolved spelling.
 *
 * A compile learns its dependency-only paths only from the envelope it returns,
 * so the paths read here are the ones an earlier compile of the same project
 * reported. A path the compile reports for the first time has no witness, and
 * its generation is compiled again with one (samchon/ttsc#1541).
 *
 * @param paths Dependency-only paths an earlier compile reported.
 * @param filesystem The filesystem the compile reads.
 *
 * @evidence contracts/common.md#principled-implementation Content, physical target and metadata boundaries are captured before compile; signature equality records one comparison rather than certifying an atomic read or usable metadata.
 * @evidence contracts/common.md#clear-and-simple-design One witness constructor groups the dependency observations required by postcompile admission, leaving retry policy to generation ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A newly reported path has no invented earlier witness; its owner must compile with a real pre-read observation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain earlier-report inputs and the first-discovery recompile premise before argument tags.
 * @evidence contracts/portability.md#os-neutral-implementation Injected native operations observe content, link targets and timestamps while lexical resolved spellings keep alias metadata witnesses distinct.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Witness ownership transfers to the compile attempt and temporary map size follows reported dependency paths; this helper acquires no persistent handle.
 * @evidence contracts/performance.md#efficient-algorithms
 *   N supplied occurrences each receive metadata/content/realpath/metadata
 *   observations and native resolved-key construction. Bytes read/hash dominate
 *   large files, while component/link resolution and metadata/bigint signature
 *   text remain real costs. Duplicate resolved keys still reread and overwrite;
 *   U final keys retain hashes/targets/signatures, not the read buffers.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The attempt shares these precompile endpoints with postcompile admission,
 *   which compares signatures, content and physical target and rejects absent
 *   witnesses or changed comparisons. New paths need a later attempt with a
 *   pre-read; matching endpoints are not a plugin-recorded read proof.
 */
export function witnessExternalDependencies(
  paths: readonly string[],
  filesystem: TtscTransformFilesystemOperations,
): Map<string, TtscExternalDependencyWitness> {
  const witnesses = new Map<string, TtscExternalDependencyWitness>();
  for (const input of paths) {
    const before = inputMetadataSignature(input, filesystem);
    const hash = hostInputStateHash(input, filesystem);
    const realpath = hostInputRealpath(input, filesystem);
    const after = inputMetadataSignature(input, filesystem);
    witnesses.set(path.resolve(input), {
      hash,
      realpath,
      signature: after,
      stable: before === after,
    });
  }
  return witnesses;
}

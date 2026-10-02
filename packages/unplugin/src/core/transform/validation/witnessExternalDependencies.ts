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
 * @evidence contracts/common.md#principled-implementation Content, physical target and metadata are captured before compile; matching before/after metadata qualifies one coherent read rather than an arbitrary later state.
 * @evidence contracts/common.md#clear-and-simple-design One witness constructor groups the dependency observations required by postcompile admission, leaving retry policy to generation ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A newly reported path has no invented earlier witness; its owner must compile with a real pre-read observation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain earlier-report inputs and the first-discovery recompile premise before argument tags.
 * @evidence contracts/portability.md#os-neutral-implementation Injected native operations observe content, link targets and timestamps while lexical resolved spellings keep alias metadata witnesses distinct.
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

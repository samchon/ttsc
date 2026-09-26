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

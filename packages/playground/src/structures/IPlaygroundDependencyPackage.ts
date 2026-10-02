/**
 * Metadata for one successfully installed npm package; counts refer to mounted
 * text files and declaration files, respectively.
 *
 * @evidence contracts/common.md#principled-implementation Mount name, registry identity and exact version distinguish aliases from their targets; counts describe the installed artifact population.
 * @evidence contracts/common.md#clear-and-simple-design Artifact metadata is separate from active dependency constraints and the downloaded file maps.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Registry identity is explicit rather than inferred from an alias's exposed name.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines count meaning and the registryName distinction, with separate tags under the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface IPlaygroundDependencyPackage {
  name: string;

  /** Package name queried from the registry, which differs for npm aliases. */
  registryName: string;

  version: string;
  tarball: string;
  fileCount: number;
  declarationCount: number;
}

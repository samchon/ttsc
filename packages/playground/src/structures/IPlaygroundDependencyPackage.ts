/**
 * Metadata for one successfully installed npm package; counts refer to mounted
 * text files and declaration files, respectively.
 *
 * @evidence contracts/common.md#principled-implementation Mount name, registry identity and exact version distinguish aliases from their targets; counts describe the installed artifact population.
 * @evidence contracts/common.md#clear-and-simple-design Artifact metadata is separate from active dependency constraints and the downloaded file maps.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Registry identity is explicit rather than inferred from an alias's exposed name.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines count meaning and the registryName distinction, with separate tags under the documentation skill.
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

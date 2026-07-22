/** Metadata for one successfully installed npm package. */
export interface IPlaygroundDependencyPackage {
  name: string;
  /** Package name queried from the registry, which differs for npm aliases. */
  registryName: string;
  version: string;
  tarball: string;
  fileCount: number;
  declarationCount: number;
}

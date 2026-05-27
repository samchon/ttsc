/** Metadata for one successfully installed npm package. */
export interface IPlaygroundDependencyPackage {
  name: string;
  version: string;
  tarball: string;
  fileCount: number;
  declarationCount: number;
}

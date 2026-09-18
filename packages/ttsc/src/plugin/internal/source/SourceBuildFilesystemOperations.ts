/**
 * Synchronous filesystem reads used to fingerprint external Go toolchains.
 *
 * Injectable so a test can count or fail the reads the cache-key computation
 * performs, which is how the memoization of an unchanged `GOROOT` is pinned.
 */
export interface SourceBuildFilesystemOperations {
  /** Read a file's bytes, as `fs.readFileSync` does. */
  readFile(location: string): Buffer;
}

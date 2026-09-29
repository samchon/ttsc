/**
 * Synchronous filesystem reads used to fingerprint external Go toolchains.
 *
 * The key accepts a byte reader so external toolchain fingerprinting has one
 * explicit filesystem dependency. Production supplies `fs.readFileSync`.
 *
 * @evidence contracts/common.md#principled-implementation The synchronous Buffer-returning method preserves the exact file bytes used for the Go root content identity, including ordinary read failures.
 * @evidence contracts/common.md#clear-and-simple-design The boundary contains only the byte-read operation that hashing consumes; metadata and enumeration remain with native identity validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Injection replaces an owned dependency explicitly rather than patching fs globals or adding a production path for an expected test result.
 * @evidence contracts/common.md#meaningful-documentation The owning prose identifies the fingerprinting dependency and its production reader; the member states byte-read semantics.
 * @evidence contracts/portability.md#os-neutral-implementation The reader receives native file locations and returns unmodified bytes through Node's filesystem API; path and case interpretation are not reimplemented by this interface.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The boundary type does not choose the hasher's traversal or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The interface supplies reads and owns no shared computation or cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Implementations and enclosing calls own read resources; the declaration retains no handle.
 */
export interface SourceBuildFilesystemOperations {
  /**
   * Read a file's bytes, as `fs.readFileSync` does.
   *
   * @evidence contracts/common.md#principled-implementation Synchronous byte reads provide the file content that the enclosing fingerprint computation hashes and propagate unreadable-file errors.
   * @evidence contracts/common.md#clear-and-simple-design One argument and one Buffer result express the required read capability without an asynchronous adapter.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Callers supply this capability explicitly instead of replacing foreign filesystem methods.
   * @evidence contracts/common.md#meaningful-documentation The method names its byte-read and fs.readFileSync semantics in native JSDoc.
   * @evidence contracts/portability.md#os-neutral-implementation The native location is passed to the filesystem reader unchanged rather than interpreted as a URL or slash-only protocol path.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This signature supplies byte access; the owning hash traversal chooses the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The reader does not coordinate requests or cache completed values.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature owns no file handle or retained value; synchronous implementations complete each read before returning.
   */
  readFile(location: string): Buffer;
}

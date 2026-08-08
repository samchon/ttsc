/**
 * Immutable local package archive installed into a prepared workspace.
 *
 * The workspace materializer copies this archive under `.benchmark-deps` and
 * binds its package name to the copy before installation, so the measured
 * workspace resolves that name from this repository's own tree instead of the
 * registry. The Evidence plugin arrives this way for the Evidence arm alone,
 * and the compiler toolchain arrives this way for both arms.
 */
export interface ITtscEvidenceBenchmarkWorkspaceArtifact {
  /** Package name the prepared workspace binds to this archive. */
  name: string;

  /**
   * Absolute or repository-resolved archive source path.
   *
   * Its base name becomes the name of the copy under `.benchmark-deps`, so two
   * artifacts of one request may never share one.
   */
  archive: string;
}

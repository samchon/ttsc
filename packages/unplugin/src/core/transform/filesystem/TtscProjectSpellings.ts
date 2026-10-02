/**
 * The two spellings one project root carries: the one it was named by and the
 * physical one after every link. Equal where the root traverses no link; a
 * project reached through a link keeps both, and every macOS temporary
 * directory is one (`/var/…` to `/private/var/…`).
 *
 * The compiler reports its inputs under the physical spelling, the adapter's
 * own configuration reading, walk, and trackers under the one the project was
 * named by, and a host under whichever its resolver arrives at. Containment in
 * the project is therefore decided against both (`relativeToProject`), and a
 * path is handed to another party under the spelling that party uses
 * (`hostSpelling`), never compared across the two by string.
 *
 * @evidence contracts/common.md#principled-implementation Named and physical roots are retained separately because compiler, host, and observer paths may use either spelling for one linked project.
 * @evidence contracts/common.md#clear-and-simple-design Two readonly values supply containment and consumer spelling without combining them into a lossy canonical string.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither spelling is guessed by replacing a known temporary-directory prefix or assuming all roots avoid links.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain each producer's spelling and why containment must consider both.
 */
export interface TtscProjectSpellings {
  /** The root's physical spelling, after every link. */
  readonly physical: string;

  /** The root as it was named. */
  readonly spelling: string;
}

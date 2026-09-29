import type { PlaygroundFetch } from "./IPlaygroundDependencyInstallOptions";

/**
 * Options for {@link installTypiaSourcePack} and
 * {@link createTypiaSourcePackMount}.
 *
 * @evidence contracts/common.md#principled-implementation URL, virtual mount root, abort signal and fetch injection represent independent transport and installation inputs.
 * @evidence contracts/common.md#clear-and-simple-design One shared record serves the mount adapter and installer without a second transport configuration model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Transport injection is explicit; callers need not monkey-patch global fetch to load a pack.
 * @evidence contracts/common.md#meaningful-documentation Member prose explains virtual root defaults and shared cancellation, with native paragraphs and spacing from the documentation skill.
 */
export interface IInstallTypiaSourcePackOptions {
  /** URL the site serves the pre-built typia source pack from. */
  url: string;

  /**
   * Where to mount the pack inside the MemFS. Defaults to `/work/node_modules`,
   * matching `DEFAULT_WORK_DIR + "/node_modules"`.
   */
  mountRoot?: string;

  /** Cancel the shared in-flight load. */
  signal?: AbortSignal;

  /**
   * Optional fetcher. Defaults to `globalThis.fetch`. Override for tests or for
   * sites that want their own caching strategy.
   */
  fetch?: PlaygroundFetch;
}

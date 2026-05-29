/**
 * Options for {@link installTypiaSourcePack} and
 * {@link createTypiaSourcePackMount}.
 */
export interface IInstallTypiaSourcePackOptions {
  /** URL the site serves the pre-built typia source pack from. */
  url: string;
  /**
   * Where to mount the pack inside the MemFS. Defaults to `/work/node_modules`,
   * matching `DEFAULT_WORK_DIR + "/node_modules"`.
   */
  mountRoot?: string;
  /**
   * Optional fetcher. Defaults to `globalThis.fetch`. Override for tests or for
   * sites that want their own caching strategy.
   */
  fetch?: (input: string) => Promise<Response>;
}

/** Source-plugin cache locations resolved for one ttsc invocation. */
export interface ITtscSourceBuildCachePaths {
  /** Root directory containing all ttsc-owned source build caches. */
  root: string;
  /** Directory containing content-addressed compiled plugin binaries. */
  pluginRoot: string;
  /** Directory passed to Go as `GOCACHE` for source-plugin builds. */
  goBuildRoot: string;
  /** How `goBuildRoot` was selected. */
  goBuildRootSource: "ttsc-cache" | "TTSC_GO_CACHE_DIR" | "GOCACHE";
}

import type { TtscPluginStage } from "./TtscPluginStage";

/** Runtime descriptor returned by a ttsc plugin module. */
export interface ITtscPlugin {
  /** Stable plugin name used in diagnostics and native manifests. */
  name: string;
  /**
   * Go command package directory, or a `go.mod` file, that ttsc lazily builds.
   *
   * ttsc accepts source only. It does not accept a prebuilt binary path: the
   * package-local Go compiler builds this source into the ttsc plugin cache on
   * demand.
   *
   * Directory sources search upward at most 3 parent directories for `go.mod`;
   * direct `go.mod` sources build the module root as `.`.
   *
   * Common layouts:
   *
   * - `source: "src"` when the plugin package keeps its Go command in `src`.
   * - `source: "plugin"` when the repository has a dedicated Go plugin folder.
   * - `source: "lib"` only when the published package intentionally ships Go
   *   source under `lib` instead of compiled JavaScript.
   * - `source: "go.mod"` when the module root itself is the command package.
   */
  source: string;
  /**
   * Pipeline stage implemented by the sidecar.
   *
   * @default "transform"
   */
  stage?: TtscPluginStage;
}

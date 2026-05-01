import type { TtscPluginStage } from "./TtscPluginStage";

/**
 * Runtime descriptor returned by a ttsc plugin module.
 *
 * A JavaScript plugin entry in `compilerOptions.plugins[]` is only the loading
 * point. After ttsc resolves that JavaScript module, the module must return an
 * `ITtscPlugin` descriptor either directly, as `default`, as `plugin`, or from
 * `createTtscPlugin(context)`.
 *
 * The descriptor tells ttsc which Go command package implements the native
 * sidecar and where that sidecar participates in the TypeScript-Go pipeline.
 * ttsc then builds the Go source lazily with the bundled Go toolchain and
 * passes the original project plugin config to the sidecar through
 * `--plugins-json`.
 */
export interface ITtscPlugin {
  /**
   * Stable plugin name used in diagnostics, build messages, and native plugin
   * manifests.
   *
   * Keep this stable across releases. Native sidecars and downstream tooling
   * can use the name to select their own config from the ordered
   * `--plugins-json` payload.
   */
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
   * Omit this field for normal compiler-transform plugins. Explicit stages are
   * intended for tools that only validate (`"check"`) or rewrite already
   * emitted files (`"output"`).
   *
   * @default "transform"
   */
  stage?: TtscPluginStage;
}

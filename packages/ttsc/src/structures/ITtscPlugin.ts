import type { ITtscPluginContributor } from "./ITtscPluginContributor";
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
   * Ttsc accepts source only. It does not accept a prebuilt binary path: the
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
   * Other transform plugin names or transform specifiers that this native
   * sidecar can execute in the same compiler pass.
   *
   * Package auto-discovery may find multiple transform packages that must share
   * one emit host. When one descriptor lists another entry here, ttsc keeps the
   * original plugin config in `--plugins-json` but points the composed entry at
   * this descriptor's native source so both entries resolve to one binary.
   */
  composes?: string[];

  /**
   * Pipeline stage implemented by the sidecar.
   *
   * Omit this field for normal compiler-transform plugins. The only explicit
   * non-transform stage is `"check"`.
   *
   * @default "transform"
   */
  stage?: TtscPluginStage;

  /**
   * Additional Go source packages to statically link into this plugin's binary
   * at build time ("plugin-within-plugin" composition).
   *
   * Each contributor's Go source directory is copied into the scratch build
   * tree as a sub-package of this plugin's module and reached by a synthesized
   * blank import. The contributor's `init()` runs before the host binary's
   * `main`, registering whatever state the host expects to find at startup
   * (e.g. lint rules through `github.com/samchon/ttsc/packages/lint/rule`).
   *
   * Differs from `composes`:
   *
   * - `composes` is horizontal — many plugin entries dispatch to one binary by
   *   name. Each entry is still a top-level `compilerOptions.plugins[]` citizen
   *   with its own lifecycle slot.
   * - `contributors` is vertical — one binary statically links additional Go
   *   sources that never appear as top-level plugin entries. The contributing
   *   npm packages are discovered through the host plugin's own config file
   *   (e.g. `lint.config.ts` for `@ttsc/lint`).
   *
   * Constraints:
   *
   * - Contributors ship Go source as a package (no `go.mod`); the host plugin's
   *   module supplies every transitive Go dependency. This is also a
   *   supply-chain feature — contributors cannot pull in arbitrary Go modules
   *   at build time.
   * - Contributor source paths must be absolute (the host plugin's JS factory
   *   typically resolves them through `require.resolve`).
   * - Contributor names are used as the sub-package import suffix and must be
   *   unique within a single plugin build.
   */
  contributors?: ITtscPluginContributor[];
}

import type { ITtscPluginCapabilities } from "./ITtscPluginCapabilities";
import type { ITtscPluginContributor } from "./ITtscPluginContributor";
import type { TtscPluginStage } from "./TtscPluginStage";

/**
 * Runtime descriptor returned by a ttsc plugin module.
 *
 * A JavaScript plugin entry in `compilerOptions.plugins[]` is only the loading
 * point. After ttsc resolves that JavaScript module, the module must return an
 * `ITtscPlugin` descriptor either directly, as `default`, as `plugin`, or from
 * a descriptor factory.
 *
 * The descriptor tells ttsc which Go source package implements the native
 * behavior and where it participates in the TypeScript-Go pipeline. ttsc then
 * builds the Go source lazily with the bundled Go toolchain and passes the
 * original project plugin config through `--plugins-json`.
 *
 * @evidence contracts/common.md#principled-implementation The descriptor distinguishes Go source composition, stage and declared capabilities, with explicit host-input proofs for files outside the compiler graph; these inputs determine build and reuse identity rather than plugin labels.
 * @evidence contracts/common.md#clear-and-simple-design One descriptor states the native implementation and its declared inputs, while factory evaluation, building and pipeline dispatch remain host responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source-based Go composition and capability opt-ins are supported extension mechanisms; routing never depends on name, and undeclared reads cannot be made cache-safe by compensating guesses.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains source ownership, stage, horizontal/vertical composition, capabilities and input-proof obligations; documented-member spacing and prose/tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Source and host-input paths are native identities with documented absolute/relative bases; content hashes and physical realpaths are separate proof fields so symlink retargeting remains a change. The descriptor requests Go-source building rather than a hardcoded executable suffix or shell command.
 */
export interface ITtscPlugin {
  /**
   * Optional human-readable label used in diagnostics and build messages.
   * Routing is never based on this value.
   */
  name?: string;

  /**
   * Absolute files whose contents or presence influence this descriptor or its
   * native transform for every project file.
   *
   * Ttsc automatically records the descriptor's CommonJS module graph, tsconfig
   * ancestry, package-discovery manifest, and an explicit `configFile`. Use
   * this field for additional implicit config discovery and for files a native
   * plugin reads outside the TypeScript reference graph. Missing paths are
   * valid: they represent higher-priority discovery candidates whose later
   * creation must invalidate a resident transform.
   */
  hostInputs?: string[];

  /**
   * Evaluation-time SHA-256 fingerprints for entries in {@link hostInputs}.
   *
   * Use a lowercase 64-digit digest for a file observed during descriptor
   * evaluation and `null` for a missing candidate. Ttsc's generated resolution
   * loaders also digest the stable kind marker for an existing directory
   * candidate, so replacing that directory with a file invalidates the
   * generation. The map is optional: ttsc still watches unhashed inputs, but
   * persistent adapters conservatively decline narrow generation reuse because
   * a later host snapshot cannot prove which state produced the descriptor.
   *
   * Returning the map also declares that its files are every file the factory
   * read outside its module graph; `{}` declares that it read none. Only such a
   * descriptor, with a fingerprint for each {@link hostInputs} entry, has its
   * evaluation reused by a later launch, since ttsc cannot observe a plain `fs`
   * read on every Node release it supports.
   */
  hostInputHashes?: Record<string, string | null>;

  /**
   * Evaluation-time physical paths for entries in {@link hostInputs}.
   *
   * Use the canonical path returned by `fs.realpathSync.native`, or `null` when
   * the input was missing. Persistent adapters pair this with
   * {@link hostInputHashes} so retargeting a symlink or junction cannot attach
   * output evaluated from one target to equal bytes at another target.
   */
  hostInputRealpaths?: Record<string, string | null>;

  /**
   * Go package directory, or a `go.mod` file, that ttsc lazily builds.
   *
   * Ttsc accepts source only. It does not accept a prebuilt binary path: the
   * package-local Go compiler builds this source into the ttsc plugin cache on
   * demand.
   *
   * Directory sources search upward at most 3 parent directories for `go.mod`;
   * direct `go.mod` sources build the module root as `.`. A `package main`
   * source builds as an executable sidecar; a non-`main` transform source is
   * linked into the selected native host and must register through
   * `driver.RegisterPlugin`.
   *
   * Relative paths are resolved from the consumer project root. Package
   * descriptors published in npm packages should normally return absolute paths
   * based on their own descriptor directory — derive them from a factory's
   * `context.dirname` (the load-mode-independent replacement for `__dirname`,
   * which is undefined when ttsc loads the descriptor through ttsx or as ESM).
   *
   * Common layouts:
   *
   * - `source: path.resolve(context.dirname, "src")` when a package descriptor
   *   keeps its Go command in `src`.
   * - `source: path.resolve(context.dirname, "plugin")` when a published package
   *   has a dedicated Go plugin folder.
   * - `source: "plugin"` only for project-local descriptors where the consumer
   *   project root owns the `plugin` directory.
   * - `source: "go.mod"` when the consumer project root itself is the command
   *   package; use an absolute `go.mod` path for npm package descriptors.
   */
  source: string;

  /**
   * Other transform plugin names or transform specifiers that this native
   * source can execute in the same compiler pass.
   *
   * Package auto-discovery may find multiple transform packages that must share
   * one emit host. When one descriptor lists another entry here, ttsc keeps the
   * original plugin config in `--plugins-json` but points the composed entry at
   * this descriptor's native source so both entries resolve to one binary.
   */
  composes?: string[];

  /**
   * Pipeline stage implemented by the native source.
   *
   * Omit this field for normal compiler-transform plugins. The only explicit
   * non-transform stage is `"check"`. Check-stage plugins receive `check`
   * during normal builds and may implement `fix` for `ttsc fix` and `format`
   * for `ttsc format`.
   *
   * @default "transform"
   */
  stage?: TtscPluginStage;

  /**
   * Optional host behaviors declared by the native source.
   *
   * Ttsc carries a few cross-cutting command-line flags (`--singleThreaded`,
   * `--checkers`, …) the lint sidecar parses but a typical third-party
   * transform host does not. Capabilities also cover opt-in host protocols such
   * as LSP sidecar probing. Every capability defaults to `false`.
   *
   * @see ITtscPluginCapabilities
   */
  capabilities?: ITtscPluginCapabilities;

  /**
   * Whether a check-stage sidecar reports the normal TypeScript diagnostics for
   * the project as part of its `check` subcommand.
   *
   * Leave this unset for ordinary check plugins that only report their own
   * diagnostics; ttsc will keep running a separate `tsgo --noEmit` guard so
   * TypeScript errors are not suppressed. Set it only when the sidecar builds
   * the project Program and emits the same TypeScript diagnostics the guard
   * would have produced.
   */
  reportsTypeScriptDiagnostics?: boolean;

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

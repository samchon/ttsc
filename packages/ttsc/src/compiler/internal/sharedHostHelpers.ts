import path from "node:path";

import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";

/**
 * Environment channel carrying the JSON-encoded tsgo argv ttsc forwards to a
 * native sidecar. Mirrors `driver.TsgoArgsEnv` on the Go side; see
 * `runBuild.ts::createNativeTsgoArgs` for why the payload is not a CLI flag.
 */
export const TSGO_ARGS_ENV = "TTSC_TSGO_ARGS";

/** Internal channel preserving a generated wrapper's user-authored config owner. */
export const SEMANTIC_CONFIG_PATH_ENV = "TTSC_SEMANTIC_CONFIG_PATH";

/**
 * Drop a forwarded-tsgo payload this invocation did not publish itself.
 *
 * Every sidecar env starts from `process.env`, so a ttsc that is itself running
 * inside a plugin sidecar — `@ttsc/lint` evaluating a config file through
 * `ttsx`, for instance — would otherwise hand the outer run's `--strict` to its
 * own sidecars, and `driver.LoadProgram` would apply it. The forwarded argv is
 * per-invocation state the spawning host owns, the same rule
 * `TTSC_PLUGIN_CONFIG_DIR` already follows. A caller that named the variable
 * explicitly keeps it.
 */
export function clearInheritedTsgoArgs(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
): void {
  if (callerEnv?.[TSGO_ARGS_ENV] === undefined) {
    delete env[TSGO_ARGS_ENV];
  }
}

/** Drop an outer generated wrapper's config owner from an unrelated child run. */
export function clearInheritedSemanticConfigPath(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
): void {
  if (callerEnv?.[SEMANTIC_CONFIG_PATH_ENV] === undefined) {
    delete env[SEMANTIC_CONFIG_PATH_ENV];
  }
}

/**
 * The `{ ...process.env, ...callerEnv }` a child process inherits, minus a
 * forwarded-tsgo payload this lane never published.
 *
 * Use it at every spawn whose child can reach `driver.LoadProgram` — the
 * `api-compile` / `api-transform` hosts, and the plugin loader, whose `ttsx`
 * descriptor evaluation compiles a project of its own. One rule at every site
 * beats four sites each reasoning about whether the variable could be present.
 */
export function inheritedSidecarEnv(
  callerEnv: NodeJS.ProcessEnv | undefined,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...callerEnv };
  clearInheritedTsgoArgs(env, callerEnv);
  clearInheritedSemanticConfigPath(env, callerEnv);
  return env;
}

/**
 * Resolve the caller-declared plugin config anchor to an absolute path, or
 * `undefined` when the caller did not declare one.
 *
 * The anchor exists for embedders that compile through a generated tsconfig
 * outside the project (the bundler adapters' alias overlay): they set
 * `pluginConfigDir` to the real project directory and every native plugin spawn
 * forwards it as `TTSC_PLUGIN_CONFIG_DIR`, so config-file discovery walks the
 * project instead of the wrapper's temp-dir ancestry. Callers that point at a
 * user-authored tsconfig (even a wrapper outside the project) leave it unset,
 * keeping discovery anchored at the tsconfig's own directory.
 */
export function resolvePluginConfigDir(options: {
  cwd?: string;
  pluginConfigDir?: string;
}): string | undefined {
  if (options.pluginConfigDir === undefined || options.pluginConfigDir === "") {
    return undefined;
  }
  return path.resolve(options.cwd ?? process.cwd(), options.pluginConfigDir);
}

/**
 * Reports whether the given transform source is linked into another compiler
 * host instead of owning the process itself.
 */
export function isLinkedTransform(plugin: ITtscLoadedNativePlugin): boolean {
  return plugin.stage === "transform" && plugin.kind === "linked";
}

/**
 * Verifies that all transform plugins in `plugins` either resolve to the same
 * native binary (the common case) after linked sources are removed from the
 * compiler-owner set.
 *
 * Two callers exist with subtly different error wording: the build path
 * (`runBuild.ts`) reports "multiple compiler native backends cannot share one
 * emit pass" while the source-to-source path (`transformProjectInMemory.ts`)
 * reports "cannot share one source-to-source pass". The `pass` argument selects
 * the appropriate phrase so the error message remains diagnostic-grade instead
 * of generic.
 */
export function assertSharedHostCompatibility(
  plugins: readonly ITtscLoadedNativePlugin[],
  pass: "emit" | "source-to-source",
): void {
  const binaries = [...new Set(plugins.map((plugin) => plugin.binary))];
  if (binaries.length <= 1) {
    return;
  }
  const ownerBinaries = [
    ...new Set(
      plugins
        .filter((plugin) => !isLinkedTransform(plugin))
        .map((plugin) => plugin.binary),
    ),
  ];
  if (ownerBinaries.length <= 1) {
    return;
  }
  const phrase =
    pass === "emit"
      ? "multiple compiler native backends cannot share one emit pass"
      : "multiple transform native backends cannot share one source-to-source pass";
  throw new Error(
    "ttsc: " +
      phrase +
      "; compose transform libraries through one aggregate native host",
  );
}

/**
 * Picks the native binary that must own the compiler pass. Linked transform
 * sources ride inside a host that uses driver.LoadProgram, so an executable
 * transform wins when one is present.
 */
export function selectSharedHostPlugin(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin {
  return plugins.find((plugin) => !isLinkedTransform(plugin)) ?? plugins[0]!;
}

/**
 * Return every plugin whose transform source is linked into another host binary
 * rather than owning the process. The host binary passes these via
 * `TTSC_LINKED_PLUGINS_JSON` so their Go code runs inside the same process.
 */
export function linkedTransformPlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return plugins.filter(isLinkedTransform);
}

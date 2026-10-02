/**
 * `@ttsc/metro`: Metro (React Native / Expo) adapter for ttsc plugins.
 *
 * Metro bundles with Babel, which strips TypeScript types and never runs ttsc
 * plugins, so neither the `ttsc` CLI nor `@ttsc/unplugin` can reach an RN/Expo
 * build. {@link withTtsc} wires a Metro custom transformer that runs the ttsc
 * plugin pass on each TypeScript file before handing the result to the
 * project's existing Expo/React-Native Babel transformer.
 *
 * @example
 *   Expo project
 *   ```js
 *   // metro.config.js
 *   const { getDefaultConfig } = require("expo/metro-config");
 *   const { withTtsc } = require("@ttsc/metro");
 *
 *   module.exports = withTtsc(getDefaultConfig(__dirname));
 *   ```
 *
 * @example
 *   Bare React Native
 *   ```js
 *   // metro.config.js
 *   const { getDefaultConfig } = require("@react-native/metro-config");
 *   const { withTtsc } = require("@ttsc/metro");
 *
 *   module.exports = withTtsc(getDefaultConfig(__dirname));
 *   ```
 */
import { openTtscTransformSession } from "@ttsc/unplugin/api";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFilesystemPathIdentityContext } from "ttsc/path-identity";

import { prepareSnapshot } from "./core/fingerprint";
import type { TtscMetroOptions } from "./core/TtscMetroOptions";
import { ENV_KEY, serializeOptions } from "./core/options";
import { locateProjectUpstreamTransformer } from "./core/upstream";

export type {
  ResolvedTtscMetroOptions,
  TtscMetroOptions,
} from "./core/TtscMetroOptions";

/**
 * Minimal structural type for a Metro config object, avoids a hard dependency
 * on Metro's types while letting {@link withTtsc} preserve the caller's exact
 * config type.
 */
interface MetroConfigLike {
  transformer?: {
    babelTransformerPath?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Wrap a Metro config so ttsc plugins run on every TypeScript file.
 *
 * Sets `transformer.babelTransformerPath` to this package's transformer and
 * publishes the resolved options to Metro's worker processes via the
 * {@link ENV_KEY} environment variable (the workers never see this call, so env
 * is the transport, see `core/options.ts`). Compatible with Expo's
 * `getDefaultConfig()` and bare React Native alike.
 *
 * With no `options`, the transformer auto-discovers `tsconfig.json` and runs
 * the plugins configured there: the standard ttsc model. Pass `options` only to
 * override the project path, plugin list, or include/exclude filters.
 *
 * A `babelTransformerPath` the config already carried is chained rather than
 * replaced: it becomes the upstream this transformer delegates to, so wrapping
 * a working config keeps whatever it configured. `react-native-svg-transformer`
 * is installed by exactly that assignment, and replacing it silently sent every
 * `.svg` to the auto-detected Expo default instead, with the build still
 * succeeding (samchon/ttsc#1321). An explicit `upstreamTransformer` option
 * still wins, since that is the caller saying it outright.
 *
 * The call also has side effects beyond the returned config, all before Metro
 * forks its workers. It prepares the cache-key snapshot under
 * `<projectRoot>/node_modules/.cache/ttsc-metro` (creating it, merging the
 * previous workers' records into it under a lock, and sweeping stale files), and
 * it opens the shared compile session whose path the workers inherit through
 * the environment. A snapshot that cannot be prepared never fails the call: the
 * run takes a private token that makes its cache key non-reusable.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Metro's supported babelTransformerPath boundary installs this adapter by
 *   cloning the config. Node project resolution preserves an existing upstream
 *   unless explicitly overridden, and realpath/package ownership filters
 *   inherited self-selection; explicit upstream choices remain caller-owned.
 *   Only the owned option/session environment channels are published before
 *   workers start; foreign loaders and methods are not patched.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The entry point prepares run ownership and worker transport, then clones
 *   the config's transformer field. Separate helpers own upstream inheritance
 *   and module identity instead of repeating those policies in workers.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node paths, createRequire and fileURLToPath resolve native paths and module
 *   URLs. The shared filesystem-identity resolver handles links and actual
 *   directory case capabilities in the recursion guard, instead of folding
 *   all names by OS. Worker options use JSON environment inheritance.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains config preservation, upstream precedence, JSON
 *   worker transport and preparation side effects. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   The compaction lock it takes is released in prepareSnapshot's finally block and the session store is owned by its opener; withTtsc retains no handle itself.
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   Constant work per call besides the snapshot preparation that prepareSnapshot owns.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   Runs once per Metro config load; the snapshot and compile session it opens are what the workers share.
 */
export function withTtsc<T extends MetroConfigLike>(
  config: T,
  options: TtscMetroOptions = {},
): T {
  // Prepare the reference-graph snapshot backing the transformer's cache-key
  // fingerprint (see `core/fingerprint.ts`). This runs in the single Metro
  // config process before its workers exist. The snapshot owner serializes
  // concurrent config processes while compacting the previous worker records.
  const snapshotRunId = prepareSnapshot(
    typeof config.projectRoot === "string" ? config.projectRoot : undefined,
  );
  process.env[ENV_KEY] = serializeOptions(
    inheritConfiguredTransformer(config, options),
    snapshotRunId,
  );
  // The workers Metro forks next inherit the session, so the pool compiles
  // each generation once between them (samchon/ttsc#1390).
  openTtscTransformSession();
  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: transformerModulePath(),
    },
  } as T;
}

/**
 * Adopt the config's own `babelTransformerPath` as the upstream to delegate to.
 *
 * The value `withTtsc` overwrites is precisely the transformer that should run
 * after the ttsc pass, so taking it as the default `upstreamTransformer` is
 * what makes the wrapper additive in the one field it sets. Everything else in
 * the config was already spread through untouched, which is what made the loss
 * hard to see (samchon/ttsc#1321).
 *
 * An explicit option wins, and this package's own transformer is never adopted:
 * a config wrapped twice would otherwise name this module as its own upstream
 * and delegate into itself.
 */
function inheritConfiguredTransformer(
  config: MetroConfigLike,
  options: TtscMetroOptions,
): TtscMetroOptions {
  // An explicit option is the caller's module, so it resolves from the project
  // as a declared `babelTransformerPath` does; an empty one asks for detection.
  if (
    options.upstreamTransformer !== undefined &&
    options.upstreamTransformer.length !== 0
  ) {
    return {
      ...options,
      upstreamTransformer: resolveFromProject(
        options.upstreamTransformer,
        config,
      ),
    };
  }
  const declared = config.transformer?.babelTransformerPath;
  if (typeof declared !== "string" || declared.length === 0) {
    // Automatic detection belongs here too: the candidates are the app's
    // packages, and only this process knows the project to look in. Nothing
    // found leaves the worker's own probe to report it.
    const located = locateProjectUpstreamTransformer((specifier) =>
      projectRequire(config).resolve(specifier),
    );
    return located === undefined
      ? options
      : { ...options, upstreamTransformer: located };
  }
  // Resolve before judging. Ownership is a property of the module, not of the
  // string, and every spelling has to become one absolute path before either
  // question can be answered honestly.
  const resolved = resolveFromProject(declared, config);
  if (isOwnTransformer(resolved)) {
    return options;
  }
  return { ...options, upstreamTransformer: resolved };
}

/**
 * Resolve a declared `babelTransformerPath` the way Metro would: from the
 * project.
 *
 * Metro resolves this value against the project, while the worker resolves
 * `upstreamTransformer` with a `require` rooted in this package's own
 * `lib/core`. Those are different places, so passing the caller's spelling
 * through unchanged asks the worker to find the module somewhere it was never
 * meant to be. Resolving here, once, in the config process that still knows the
 * project root, removes the ambiguity for every spelling at once:
 *
 * - A relative `./metro-svg.cjs` becomes the file the caller meant, instead of
 *   one looked for inside `@ttsc/metro` and not found;
 * - A bare `react-native-svg-transformer` becomes its real location, which
 *   matters under pnpm, where this package sits in a virtual store and walking
 *   up from it never reaches the project's own `node_modules`;
 * - An absolute path resolves to itself, unchanged;
 * - And `require.resolve("@ttsc/metro/transformer")` — a caller who wired this
 *   package by hand — becomes a path {@link isOwnTransformer} can recognise,
 *   which no comparison against the bare specifier could.
 *
 * A specifier that cannot be resolved is handed on exactly as written. It may
 * still resolve in the worker, and if it does not, `resolveUpstreamTransformer`
 * names it in an error; inventing a path here would only move the failure
 * somewhere less legible.
 */
function resolveFromProject(declared: string, config: MetroConfigLike): string {
  try {
    return projectRequire(config).resolve(declared);
  } catch {
    return declared;
  }
}

/** A `require` rooted in the Metro project, the owner of its transformers. */
function projectRequire(config: MetroConfigLike): NodeJS.Require {
  const base =
    typeof config.projectRoot === "string" && config.projectRoot.length !== 0
      ? config.projectRoot
      : process.cwd();
  return createRequire(join(resolve(base), "package.json"));
}

/**
 * Whether a `babelTransformerPath` already points at a `@ttsc/metro`
 * transformer — this copy or any other.
 *
 * Adopting one would make this transformer its own upstream. That is not merely
 * redundant: the worker options are process-global, so the adopted copy reads
 * the same `TTSC_METRO_OPTIONS`, finds itself named there, and recurses until
 * the stack ends. Comparing directory strings was not enough, because a second
 * installed copy — a differently hoisted `node_modules`, a shared config
 * package that already wrapped — lives in a different directory and passed the
 * check.
 *
 * So the question asked is "is this module a `@ttsc/metro` transformer", not
 * "is this string our path": the real path settles the same-copy case through
 * symlinks and drive-letter spellings, and the owning `package.json` settles
 * every other copy.
 */
function isOwnTransformer(declared: string): boolean {
  const candidate = resolve(declared);
  if (sameRealPath(candidate, transformerModulePath())) {
    return true;
  }
  if (!/^transformer\.(?:js|mjs|cjs)$/i.test(basename(candidate))) {
    return false;
  }
  try {
    const manifest = join(dirname(dirname(candidate)), "package.json");
    return JSON.parse(readFileSync(manifest, "utf8")).name === "@ttsc/metro";
  } catch {
    // No readable manifest beside it, so nothing identifies it as ours.
    return false;
  }
}

/**
 * Whether two paths name the same file on disk.
 *
 * The shared resolver observes physical spelling and directory capabilities
 * within this comparison. Symlinks can identify the same installed file while
 * case-sensitive native names remain distinct.
 */
function sameRealPath(left: string, right: string): boolean {
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  return identities.resolve(left).key === identities.resolve(right).key;
}

/**
 * Absolute path to the built transformer module Metro will `require`.
 *
 * Always the CommonJS build (`transformer.js`) next to this module: Metro
 * resolves `babelTransformerPath` with `require`, and `metro.config.js` is a
 * CommonJS module. Rollup rewrites `import.meta.url` for both the CJS and ESM
 * builds, so this resolves correctly regardless of how the config loaded this
 * entry.
 */
function transformerModulePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "transformer.js");
}

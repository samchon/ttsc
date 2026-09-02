import { isDeepStrictEqual } from "node:util";

import bun, { type BunLikePlugin } from "./bun";
import type { TtscUnpluginOptions } from "./core/options";

/**
 * Minimal shape of the Bun runtime global used to register a runtime plugin.
 *
 * Declared locally so the package needs no `bun-types` dependency; at runtime
 * Bun exposes `Bun.plugin`, which accepts the same object the bundler adapter
 * returns.
 */
interface BunRuntimeGlobal {
  plugin(plugin: BunLikePlugin): void;
}

/**
 * Pending and locked options for the single runtime loader.
 *
 * Bun uses the first matching `onLoad` hook and does not fall through to a
 * later overlapping plugin (oven-sh/bun#20583). Registering twice — once
 * implicitly on import, once explicitly — would let the default loader shadow
 * the configured one. Instead exactly one Bun plugin is registered. Calls made
 * before its first load replace this detached snapshot; the first load locks
 * that value for the process's immutable module-loading session.
 */
let activeOptions: TtscUnpluginOptions | undefined;
let lockedOptions: TtscUnpluginOptions | undefined;
let optionsLocked = false;
/** Whether the single runtime loader has already been registered with Bun. */
let registered = false;

/**
 * Register the ttsc transform as a Bun **runtime** plugin.
 *
 * The other `@ttsc/unplugin/*` adapters cover bundlers (`Bun.build`, Vite,
 * Webpack, …). This entry is the runtime counterpart: loading it registers the
 * same transform on Bun's module loader, so `bun run` / `bun test` apply ttsc
 * plugins (e.g. typia's `typia/lib/transform`) as files are imported, with no
 * bundling step. Wire it up once via a `bunfig.toml` preload entry — `preload =
 * ["@ttsc/unplugin/bun-register"]` — or imperatively with `import
 * "@ttsc/unplugin/bun-register"`. Options are read from the nearest
 * `tsconfig.json`, identical to the bundler adapters.
 *
 * The first call registers one loader. Calls before its first TypeScript load
 * use last-call-wins and capture options by value, so an explicit call right
 * after importing this module replaces the preload defaults without installing
 * a shadowing loader. The first load locks that snapshot. Later calls with a
 * structurally identical value are idempotent; a different value throws rather
 * than pretending a resolved loader changed configuration.
 *
 * @throws When called explicitly off the Bun runtime, when options are not
 *   structured-cloneable, or when a different option value is supplied after
 *   the first load. The auto-registration below stays silent off Bun so the
 *   module is harmless to import from Node (tests, tooling).
 */
export function register(options?: TtscUnpluginOptions): void {
  const runtime = bunRuntime();
  if (runtime === undefined) {
    throw new Error(
      "@ttsc/unplugin/bun-register must run under the Bun runtime " +
        "(globalThis.Bun.plugin is unavailable). Use a bundler adapter such as " +
        "@ttsc/unplugin/vite for non-Bun toolchains.",
    );
  }
  const snapshot = snapshotOptions(options);
  if (optionsLocked) {
    if (isDeepStrictEqual(snapshot, lockedOptions)) {
      return;
    }
    throw new Error(
      "@ttsc/unplugin/bun-register options are locked because the runtime " +
        "loader has already handled a TypeScript module. Restart the Bun " +
        "process to use different compiler or plugin options.",
    );
  }
  activeOptions = snapshot;
  if (registered) {
    return;
  }
  registered = true;
  try {
    runtime.plugin(bun(lockOptions));
  } catch (error) {
    registered = false;
    throw error;
  }
}

/** Lock and return the detached option snapshot on the first module load. */
function lockOptions(): TtscUnpluginOptions | undefined {
  if (!optionsLocked) {
    lockedOptions = activeOptions;
    optionsLocked = true;
  }
  return lockedOptions;
}

/** Detach JSON-shaped options from mutations made after `register` returns. */
function snapshotOptions(
  options: TtscUnpluginOptions | undefined,
): TtscUnpluginOptions | undefined {
  if (options === undefined) return undefined;
  try {
    return structuredClone(options);
  } catch (cause) {
    throw new TypeError(
      "@ttsc/unplugin/bun-register options must contain structured-cloneable values.",
      { cause },
    );
  }
}

function bunRuntime(): BunRuntimeGlobal | undefined {
  const runtime = (globalThis as { Bun?: BunRuntimeGlobal }).Bun;
  return runtime !== undefined && typeof runtime.plugin === "function"
    ? runtime
    : undefined;
}

// Auto-register on import so a `bunfig.toml` `preload` entry — which only
// imports the module — takes effect. Guarded so importing from Node (a stray
// import, or a unit test) is a harmless no-op rather than a throw.
if (bunRuntime() !== undefined) {
  register();
}

export default register;

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

interface BunRegistrationState {
  activeOptions: TtscUnpluginOptions | undefined;
  lockedOptions: TtscUnpluginOptions | undefined;
  optionsLocked: boolean;
  registered: boolean;
}

/**
 * Pending and locked options for the single runtime loader.
 *
 * Bun uses the first matching `onLoad` hook and does not fall through to a
 * later overlapping plugin (oven-sh/bun#20583). Registering twice — once
 * implicitly on import, once explicitly — would let the default loader shadow
 * the configured one. Instead exactly one Bun plugin is registered. Calls made
 * before its first load replace this detached snapshot; entering the first
 * transformable load locks that value synchronously for the process's immutable
 * module-loading session. State is keyed by the Bun runtime in a global weak
 * map so loading both emitted module conditions cannot install two overlapping
 * loaders.
 */
const BUN_REGISTRATION_STATES = Symbol.for(
  "@ttsc/unplugin/bun-register/states/v1",
);

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
 * The first call registers one loader. Calls before its first transformable
 * TypeScript load use last-call-wins and capture options by value, so an
 * explicit call right after importing this module replaces the preload defaults
 * without installing a shadowing loader. Entering the first such load locks
 * that snapshot synchronously. Later calls with a structurally identical value
 * are idempotent; a different value throws rather than pretending a resolved
 * loader changed configuration.
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
  const state = registrationState(runtime);
  const snapshot = snapshotOptions(options);
  if (state.optionsLocked) {
    if (isDeepStrictEqual(snapshot, state.lockedOptions)) {
      return;
    }
    throw new Error(
      "@ttsc/unplugin/bun-register options are locked because the runtime " +
        "loader has started handling a TypeScript module. Restart the Bun " +
        "process to use different compiler or plugin options.",
    );
  }
  state.activeOptions = snapshot;
  ensureRegistered(runtime, state);
}

/** Install the runtime's one loader without changing its pending options. */
function ensureRegistered(
  runtime: BunRuntimeGlobal,
  state: BunRegistrationState,
): void {
  if (state.registered) return;
  state.registered = true;
  try {
    runtime.plugin(bun(() => lockOptions(state)));
  } catch (error) {
    state.registered = false;
    throw error;
  }
}

/** Lock and return the detached option snapshot at first load-handler entry. */
function lockOptions(
  state: BunRegistrationState,
): TtscUnpluginOptions | undefined {
  if (!state.optionsLocked) {
    state.lockedOptions = state.activeOptions;
    state.optionsLocked = true;
  }
  return state.lockedOptions;
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

/** Resolve the shared state owned by one concrete Bun runtime object. */
function registrationState(runtime: BunRuntimeGlobal): BunRegistrationState {
  const holder = globalThis as unknown as Record<PropertyKey, unknown>;
  let states = holder[BUN_REGISTRATION_STATES];
  if (!(states instanceof WeakMap)) {
    states = new WeakMap<object, BunRegistrationState>();
    Object.defineProperty(holder, BUN_REGISTRATION_STATES, {
      configurable: false,
      enumerable: false,
      value: states,
      writable: false,
    });
  }
  const registrations = states as WeakMap<object, BunRegistrationState>;
  const existing = registrations.get(runtime);
  if (existing !== undefined) return existing;
  const created: BunRegistrationState = {
    activeOptions: undefined,
    lockedOptions: undefined,
    optionsLocked: false,
    registered: false,
  };
  registrations.set(runtime, created);
  return created;
}

// Auto-register on import so a `bunfig.toml` `preload` entry — which only
// imports the module — takes effect. Guarded so importing from Node (a stray
// import, or a unit test) is a harmless no-op rather than a throw.
const runtime = bunRuntime();
if (runtime !== undefined) {
  ensureRegistered(runtime, registrationState(runtime));
}

export default register;

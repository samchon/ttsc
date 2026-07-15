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
 * Effective options for the single runtime loader.
 *
 * Bun uses the first matching `onLoad` hook and does not fall through to a
 * later overlapping plugin (oven-sh/bun#20583). Registering twice — once
 * implicitly on import, once explicitly — would let the default loader shadow
 * the configured one. Instead exactly one Bun plugin is registered; it resolves
 * these options lazily on first load (see {@link bun}'s provider form), so an
 * explicit `register(options)` made right after importing this module overrides
 * the preload defaults without a second shadowing registration.
 */
let activeOptions: TtscUnpluginOptions | undefined;
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
 * Registration is idempotent: the first call (implicit on import, or explicit)
 * registers the one loader with Bun; later calls only update the effective
 * options, so accessing the explicit API cannot install a second default loader
 * that shadows the caller's configuration. Repeated explicit calls are
 * last-write-wins for the effective options.
 *
 * @throws When called explicitly off the Bun runtime (`globalThis.Bun.plugin`
 *   is unavailable). The auto-registration below stays silent off Bun so the
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
  activeOptions = options;
  if (registered) {
    return;
  }
  registered = true;
  // Register a single loader whose options are read from `activeOptions` on
  // first load, so an explicit call made after the import-time auto-register
  // still wins.
  runtime.plugin(bun(() => activeOptions));
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

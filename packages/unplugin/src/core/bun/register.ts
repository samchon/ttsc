import { isDeepStrictEqual } from "node:util";

import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";
import { bunRuntime } from "./bunRuntime";
import { ensureRegistered } from "./ensureRegistered";
import { registrationState } from "./registrationState";

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
 *   the first load. The import-time registration of the entry stays silent off
 *   Bun so the module is harmless to import from Node (tests, tooling).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Structured cloning captures option values before installation. Before first
 *   load the pending snapshot is replaceable; afterward deep equality permits
 *   only idempotent calls, matching the immutable runtime module session.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The entry coordinates capability detection, snapshot creation and state
 *   checks while ensureRegistered exclusively installs the single loader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Off-runtime and changed-after-lock failures report unsupported requests;
 *   they do not patch Bun or install compensating overlapping loaders.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish preload and explicit registration, option
 *   locking and thrown failures; separated tags follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   structuredClone follows the supplied option graph and allocates its detached
 *   snapshot; a locked call additionally pays deep-comparison cost even when
 *   idempotent. First installation delegates plugin construction/setup to
 *   ensureRegistered and the host. Fixed entry-point branches do not erase these costs.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Runtime-keyed state shares one registration. Before lock each call replaces
 *   activeOptions; after lock only deep-strict-equal snapshots are accepted,
 *   without replacing the installed loader or changing its effective options.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Transfers the detached snapshot into runtime state, replacing the old pending
 *   value until lock. The installed provider/state retains locked options and
 *   the loader's setup cache for the runtime session; no teardown or fixed option
 *   byte bound is provided here. Rejected snapshot/deep-compare values are local.
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

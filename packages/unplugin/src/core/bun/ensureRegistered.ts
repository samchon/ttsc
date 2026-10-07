import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";
import type { BunRegistrationState } from "./BunRegistrationState";
import type { BunRuntimeGlobal } from "./BunRuntimeGlobal";
import { bun } from "./bun";

/**
 * Install the runtime's one loader without changing its pending options.
 *
 * The import-time registration of `bun-register` calls this, so importing the
 * entry after an explicit `register(options)` keeps those options rather than
 * resetting them to the defaults. A runtime that rejects the plugin leaves the
 * state unregistered, so a later call can try again.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Marking registration before calling Bun prevents reentrant installation;
 *   synchronous rejection restores that flag. The provider locks the pending
 *   snapshot exactly when the first transformable load requests options.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This operation owns installation, while lockOptions owns its first-load
 *   transition; register remains responsible for snapshot validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Retrying only rejected registration reflects the host's real failure state;
 *   an accepted loader is never shadowed to fake reconfiguration.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain option preservation and rejection effects rather
 *   than restating branches; prose/tag separation follows documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Installs through the supplied runtime capability without native path or
 *   executable selection. The loader's later native reads/transforms remain
 *   its separate boundary, not a platform guarantee from registration.
 * @evidence contracts/performance.md#efficient-algorithms
 *   An already-registered state returns immediately. Installation constructs
 *   the plugin/provider once and delegates to runtime.plugin, which owns setup
 *   and host work; the fixed flag checks do not make that call constant cost.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The registered flag makes the Bun plugin register once per runtime and
 *   skips repeat calls. The flag is set before the host call to prevent
 *   reentrancy; only synchronous rejection resets it, not asynchronous host
 *   failures or a first-load option lock that the host already triggered.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Registers one Bun plugin that stays for the process life, the intended
 *   lifetime of a loader, with no teardown API here. Its provider retains the
 *   state/options; native transform caches belong to setup. Synchronous rejection
 *   resets the registration flag, without rolling back arbitrary host effects.
 */
export function ensureRegistered(
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

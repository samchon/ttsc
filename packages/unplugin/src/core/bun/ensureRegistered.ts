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

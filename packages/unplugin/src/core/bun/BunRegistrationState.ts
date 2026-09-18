import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * The single runtime loader's registration and option lifecycle for one Bun
 * runtime, shared by both emitted module conditions of `bun-register`.
 *
 * Options stay pending, replaced last-call-wins, until the loader enters its
 * first transformable load; that entry locks the pending snapshot for the rest
 * of the process.
 */
export interface BunRegistrationState {
  /** Options the next lock takes, detached from the caller's object. */
  activeOptions: TtscUnpluginOptions | undefined;
  /** Options the loader resolved with, once `optionsLocked` holds. */
  lockedOptions: TtscUnpluginOptions | undefined;
  /** Whether a load has started, which fixes `lockedOptions` for good. */
  optionsLocked: boolean;
  /** Whether the runtime already holds this state's one loader. */
  registered: boolean;
}

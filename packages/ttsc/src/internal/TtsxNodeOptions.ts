import { SidecarEnvironment } from "../compiler/internal/sharedHost/SidecarEnvironment";

/**
 * The `NODE_OPTIONS` a ttsx run received, before it appended its own preloads.
 *
 * Ttsx appends its runtime preloads (`register.js`, `runtimeOwnerPreload.js`,
 * `runtimeHookPreload.js`) to the program's `NODE_OPTIONS`, so every process
 * the program starts inherits the source loader. ttsc's own helper processes,
 * the runtime capability probe and the plugin descriptor evaluator, are not the
 * program's. They must neither run those preloads nor count them as a user's
 * startup code: both helpers refuse their caches for any non-empty
 * `NODE_OPTIONS`, so ttsx's own preloads re-probed Node and re-evaluated every
 * descriptor on every plugin load of a run (samchon/ttsc#1740). A user's own
 * `NODE_OPTIONS` still reaches the helpers and still disables both caches.
 *
 * @evidence contracts/common.md#principled-implementation The received value is recorded once, before any preload is appended, and an inner run keeps the outer run's record, so helpers see exactly the user's options.
 * @evidence contracts/common.md#clear-and-simple-design One channel name, one reader for launchers and one environment projection for helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No option string is parsed or filtered; the user's value is carried verbatim beside the augmented one.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the preloads, the helpers, the cache refusals and the user case that stays conservative.
 * @evidence contracts/portability.md#os-neutral-implementation Reads and writes go through SidecarEnvironment, which applies Windows' case-insensitive variable identity.
 * @evidence contracts/performance.md#efficient-algorithms Each call reads at most two variables and copies one environment.
 * @evidence contracts/performance.md#reuse-equivalent-work Restoring the user's options is what lets the helpers' existing caches serve a ttsx run.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained; the returned environment belongs to the caller.
 */
export namespace TtsxNodeOptions {
  /** The channel carrying the received value; empty when there was none. */
  export const RECEIVED = "TTSX_RECEIVED_NODE_OPTIONS";

  /**
   * The value a ttsx child records as received: the record of an outer ttsx
   * run, else this process's own `NODE_OPTIONS`.
   */
  export function received(env: NodeJS.ProcessEnv): string {
    return (
      SidecarEnvironment.read(env, RECEIVED) ??
      SidecarEnvironment.read(env, "NODE_OPTIONS") ??
      ""
    );
  }

  /**
   * The environment for a ttsc helper process: `NODE_OPTIONS` restored to the
   * received value inside a ttsx run, unchanged anywhere else.
   */
  export function forHelpers(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const value = SidecarEnvironment.read(env, RECEIVED);
    if (value === undefined) return env;
    const helper = { ...env };
    SidecarEnvironment.write(
      helper,
      "NODE_OPTIONS",
      value.trim() === "" ? undefined : value,
    );
    return helper;
  }
}

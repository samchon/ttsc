import { SidecarEnvironment } from "../compiler/internal/sharedHost/SidecarEnvironment";

/**
 * The `NODE_OPTIONS` a ttsx run received, beside the value it gave its program
 * after appending its own preloads.
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
 * The record travels to every descendant of the program, and a descendant may
 * set its own `NODE_OPTIONS`. So the received value is restored only while
 * `NODE_OPTIONS` is still exactly the value ttsx gave; any other value is the
 * process's own and reaches its helpers unchanged.
 *
 * @evidence contracts/common.md#principled-implementation The received and given values are recorded together before the program starts, and the received value is restored only while the given one is still in force, so helpers see exactly the options their process was started with by its user.
 * @evidence contracts/common.md#clear-and-simple-design One channel, one producer for launchers, one reader for nested launchers and one environment projection for helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No option string is parsed or filtered; values are carried and compared verbatim.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the preloads, the helpers, the cache refusals, the descendant case and the user case that stays conservative.
 * @evidence contracts/portability.md#os-neutral-implementation Reads and writes go through SidecarEnvironment, which applies Windows' case-insensitive variable identity.
 * @evidence contracts/performance.md#efficient-algorithms Each call reads at most two variables, decodes one short JSON pair and copies one environment.
 * @evidence contracts/performance.md#reuse-equivalent-work Restoring the user's options is what lets the helpers' existing caches serve a ttsx run.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained; the returned environment belongs to the caller.
 */
export namespace TtsxNodeOptions {
  /** The channel carrying `[received, given]` as JSON. */
  export const RECORD = "TTSX_NODE_OPTIONS_RECORD";

  /**
   * The variables a ttsx run gives its program: `given` as `NODE_OPTIONS` and
   * the record of what it received from `env`.
   */
  export function give(
    env: NodeJS.ProcessEnv,
    given: string,
  ): { NODE_OPTIONS: string; [RECORD]: string } {
    return {
      NODE_OPTIONS: given,
      [RECORD]: JSON.stringify([received(env), given]),
    };
  }

  /**
   * The `NODE_OPTIONS` a process received from its user: an enclosing ttsx
   * run's received value while its given value is still in force, else the
   * process's own.
   */
  export function received(env: NodeJS.ProcessEnv): string {
    const current = SidecarEnvironment.read(env, "NODE_OPTIONS") ?? "";
    const record = readRecord(env);
    return record !== undefined && record.given === current
      ? record.received
      : current;
  }

  /**
   * The environment for a ttsc helper process: `NODE_OPTIONS` restored to the
   * received value while an enclosing ttsx run's given value is in force,
   * unchanged anywhere else.
   */
  export function forHelpers(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const record = readRecord(env);
    const current = SidecarEnvironment.read(env, "NODE_OPTIONS") ?? "";
    if (record === undefined || record.given !== current) return env;
    const helper = { ...env };
    SidecarEnvironment.write(
      helper,
      "NODE_OPTIONS",
      record.received.trim() === "" ? undefined : record.received,
    );
    return helper;
  }

  function readRecord(
    env: NodeJS.ProcessEnv,
  ): { given: string; received: string } | undefined {
    const text = SidecarEnvironment.read(env, RECORD);
    if (text === undefined) return undefined;
    try {
      const value: unknown = JSON.parse(text);
      return Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === "string" &&
        typeof value[1] === "string"
        ? { given: value[1], received: value[0] }
        : undefined;
    } catch {
      return undefined;
    }
  }
}

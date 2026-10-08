import type { NativeBuildContext } from "unplugin";

import { hostDeclaresPolling } from "../transform/tracker/hostDeclaresPolling";

/**
 * Read a build host's active watch-session polling declaration.
 *
 * Webpack and Rspack accept options directly on compiler.watch(), so their
 * public watching.watchOptions can differ from the compiler configuration.
 * A closed session has no watching carrier. Other hosts retain environment
 * declarations; Vite's resolved option remains with its lifecycle owner.
 * Watchpack's environment declaration can force polling but cannot disable a
 * polling session. Chokidar-specific flags do not govern these two hosts.
 *
 * @evidence contracts/common.md#principled-implementation Webpack/Rspack session polling and Watchpack's positive environment override independently require polling. Unrelated Chokidar settings cannot cancel or manufacture that declaration; other hosts retain the generic environment policy.
 * @evidence contracts/common.md#clear-and-simple-design One capability read serves both compatible hosts and delegates environment interpretation to its existing owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No OS guess, private field or foreign method replacement stands in for a host declaration or native delivery proof.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes active session options, compiler configuration and closed sessions.
 * @evidence contracts/portability.md#os-neutral-implementation Public host capabilities select polling independently of native paths or operating systems; a native declaration does not certify event delivery.
 * @evidence contracts/performance.md#efficient-algorithms A fixed set of optional property reads precedes delegated parsing of the relevant environment values; parsing cost depends on their text lengths.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation reads current session/environment policy; no observation verdict is retained between sessions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selector retains no session, cache, watcher or task.
 */
export function buildHostDeclaresPolling(
  native: NativeBuildContext | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (native?.framework !== "webpack" && native?.framework !== "rspack")
    return hostDeclaresPolling(env);
  const poll = (
    native.compiler as {
      watching?: { watchOptions?: { poll?: boolean | number } };
    }
  ).watching?.watchOptions?.poll;
  return (
    poll === true ||
    (typeof poll === "number" && Boolean(poll)) ||
    hostDeclaresPolling({ WATCHPACK_POLLING: env.WATCHPACK_POLLING })
  );
}

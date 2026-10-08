import type { NativeBuildContext } from "unplugin";

import { hostDeclaresPolling } from "../transform/tracker/hostDeclaresPolling";

/**
 * Read a build host's active watch-session polling declaration.
 *
 * Webpack and Rspack accept options directly on compiler.watch(), so their
 * public watching.watchOptions can differ from the compiler configuration.
 * A closed session has no watching carrier. Other hosts retain environment
 * declarations; Vite's resolved option remains with its lifecycle owner.
 *
 * @evidence contracts/common.md#principled-implementation The active public watch-session option supplies the host declaration; compiler configuration cannot override that session's actual choice. Existing environment precedence remains with hostDeclaresPolling.
 * @evidence contracts/common.md#clear-and-simple-design One capability read serves both compatible hosts and delegates environment interpretation to its existing owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No OS guess, private field or foreign method replacement stands in for a host declaration or native delivery proof.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes active session options, compiler configuration and closed sessions.
 * @evidence contracts/portability.md#os-neutral-implementation Public host capabilities select polling independently of native paths or operating systems; a native declaration does not certify event delivery.
 * @evidence contracts/performance.md#efficient-algorithms A fixed set of optional property reads precedes delegated parsing of two environment values; parsing cost depends on their text lengths.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation reads current session/environment policy; no observation verdict is retained between sessions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selector retains no session, cache, watcher or task.
 */
export function buildHostDeclaresPolling(
  native: NativeBuildContext | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const poll =
    native?.framework === "webpack" || native?.framework === "rspack"
      ? (
          native.compiler as {
            watching?: { watchOptions?: { poll?: boolean | number } };
          }
        ).watching?.watchOptions?.poll
      : undefined;
  return hostDeclaresPolling(
    env,
    poll === true || (typeof poll === "number" && Boolean(poll)),
  );
}

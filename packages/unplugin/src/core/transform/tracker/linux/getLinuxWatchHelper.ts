import { spawn } from "node:child_process";
import readline from "node:readline";
import { resolveBinary } from "ttsc/binary";

import { LINUX_WATCH_HELPER } from "./LINUX_WATCH_HELPER";
import type { LinuxWatchHelper } from "./LinuxWatchHelper";
import { routeLinuxWatchHelperLine } from "./routeLinuxWatchHelperLine";

/**
 * Return the process-wide Linux watch helper, starting it on first use, or
 * `undefined` when there is none to start (samchon/ttsc#1426).
 *
 * The helper is the `__watch` command of ttsc's platform binary, found by
 * ttsc's own rules (`ttsc/binary`), so it always comes from the binary ttsc
 * itself uses. It owns one inotify instance and reports the overflow libuv
 * discards, so a watch opened through it can never lose events without notice.
 * When the helper exits, every subscription ends and every sync is released
 * unanswered, so each watch's observer stops vouching for anything; the next
 * watch starts a new helper. A binary that exits before answering at all is not
 * tried again.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The compiler-owned binary resolves the native protocol producer; exit
 *   invalidates all subscriptions and unanswered syncs before a later helper starts.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One process-wide holder owns startup and failure routing, while subscription
 *   opening and request reference accounting stay in their dedicated operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A binary that never answers is refused instead of repeatedly restarting an
 *   unsupported command or silently replacing loss-aware native notifications.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain protocol provenance, failure propagation and retry
 *   conditions under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral startup uses ttsc/binary and argument-array spawn with windowsHide;
 *   native availability is observed rather than inferred from filesystem naming.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Reusing the current helper is constant work; failure walks live subscriptions
 *   and syncs once, linear in outstanding owners rather than project file count.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   All directory subscriptions share one live helper. Failure clears only that
 *   instance; refused binary paths prevent repeating equivalent unsupported starts.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   One current child serves process-owned subscriptions and is unreferenced
 *   between requests; exit clears live state. Refused binary strings persist
 *   for process lifetime and grow with distinct rejected resolved binary paths.
 */
export function getLinuxWatchHelper(): LinuxWatchHelper | undefined {
  if (LINUX_WATCH_HELPER.current !== undefined) {
    return LINUX_WATCH_HELPER.current;
  }
  const binary = resolveBinary();
  if (binary === null || LINUX_WATCH_HELPER.refused.has(binary)) {
    return undefined;
  }
  let child;
  try {
    child = spawn(binary, ["__watch"], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
  } catch {
    LINUX_WATCH_HELPER.refused.add(binary);
    return undefined;
  }
  const helper: LinuxWatchHelper = {
    answered: false,
    child,
    nextId: 1,
    pending: 0,
    subscriptions: new Map(),
    syncs: new Map(),
  };
  const fail = (): void => {
    if (LINUX_WATCH_HELPER.current === helper) {
      LINUX_WATCH_HELPER.current = undefined;
    }
    if (!helper.answered) LINUX_WATCH_HELPER.refused.add(binary);
    const subscriptions = [...helper.subscriptions.values()];
    helper.subscriptions.clear();
    for (const release of [...helper.syncs.values()]) release(false);
    for (const subscription of subscriptions) subscription.end();
    helper.pending = 0;
  };
  child.on("error", fail);
  child.on("exit", fail);
  // Writing to a helper that already exited fails its pipe; the exit reports it.
  child.stdin?.on("error", () => undefined);
  if (child.stdout !== null) {
    readline
      .createInterface({ input: child.stdout, crlfDelay: Infinity })
      .on("line", (line) => routeLinuxWatchHelperLine(helper, line));
  }
  child.unref();
  (child.stdout as { unref?: () => void } | null)?.unref?.();
  LINUX_WATCH_HELPER.current = helper;
  return helper;
}

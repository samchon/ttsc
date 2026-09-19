import { spawn } from "node:child_process";
import readline from "node:readline";

import { LINUX_WATCH_HELPER } from "./LINUX_WATCH_HELPER";
import type { LinuxWatchHelper } from "./LinuxWatchHelper";
import { routeLinuxWatchHelperLine } from "./routeLinuxWatchHelperLine";
import { ttscNativeBinary } from "./ttscNativeBinary";

/**
 * Return the process-wide Linux watch helper, starting it on first use, or
 * `undefined` when there is none to start (samchon/ttsc#1426).
 *
 * The helper is the `__watch` command of the ttsc native binary. It owns one
 * inotify instance and reports the overflow libuv discards, so a watch opened
 * through it can never lose events without notice. When the helper exits, every
 * subscription ends and every sync is released unanswered, so each watch's
 * observer stops vouching for anything; the next watch starts a new helper. A
 * binary that exits before answering at all is not tried again.
 */
export function getLinuxWatchHelper(): LinuxWatchHelper | undefined {
  if (LINUX_WATCH_HELPER.current !== undefined) {
    return LINUX_WATCH_HELPER.current;
  }
  const binary = ttscNativeBinary();
  if (binary === undefined || LINUX_WATCH_HELPER.refused.has(binary)) {
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

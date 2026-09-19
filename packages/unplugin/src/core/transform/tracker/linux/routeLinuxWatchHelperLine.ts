import type { LinuxWatchHelper } from "./LinuxWatchHelper";
import { referenceLinuxWatchHelper } from "./referenceLinuxWatchHelper";

/**
 * Apply one line of the Linux watch helper's output to the subscription or sync
 * it names (samchon/ttsc#1426).
 *
 * The helper writes events and replies in the order it produced them, so a
 * sync's answer arrives after every event read before it. The decision is a
 * table over what the line carries:
 *
 * - A malformed line, or one naming no live subscription or sync, is ignored.
 * - `overflow` means the kernel dropped events, so every subscription hears an
 *   unattributed event, which may concern anything it covers.
 * - `synced` releases the sync waiting on that id.
 * - `ready` makes a subscription live, and `error` refuses it.
 * - `gone` ends a subscription whose directory went away.
 * - Any other line is one named event, `change` or `rename`.
 */
export function routeLinuxWatchHelperLine(
  helper: LinuxWatchHelper,
  line: string,
): void {
  let record: {
    error?: unknown;
    gone?: unknown;
    id?: unknown;
    name?: unknown;
    overflow?: unknown;
    ready?: unknown;
    synced?: unknown;
    type?: unknown;
  };
  try {
    record = JSON.parse(line) as typeof record;
  } catch {
    return;
  }
  if (record === null || typeof record !== "object") return;
  helper.answered = true;
  if (record.overflow === true) {
    for (const subscription of [...helper.subscriptions.values()]) {
      subscription.event("rename", null);
    }
    return;
  }
  if (typeof record.id !== "number") return;
  if (record.synced === true) {
    helper.syncs.get(record.id)?.(true);
    return;
  }
  const subscription = helper.subscriptions.get(record.id);
  if (subscription === undefined) return;
  if (record.ready === true || typeof record.error === "string") {
    referenceLinuxWatchHelper(helper, -1);
    if (record.ready === true) {
      subscription.ready(true);
      return;
    }
    helper.subscriptions.delete(record.id);
    subscription.ready(false);
    return;
  }
  if (record.gone === true) {
    helper.subscriptions.delete(record.id);
    subscription.end();
    return;
  }
  if (typeof record.name === "string") {
    subscription.event(
      record.type === "change" ? "change" : "rename",
      record.name,
    );
  }
}

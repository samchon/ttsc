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
 * - Invalid JSON or a non-object value is ignored. Parsed objects mark output
 *   receipt for startup policy; an unknown id invokes no owner callback.
 * - `overflow` means the kernel dropped events, so every subscription hears an
 *   unattributed event, which may concern anything it covers.
 * - `synced` releases the sync waiting on that id.
 * - `ready` makes a subscription live, and `error` refuses it.
 * - `gone` ends a subscription whose directory went away.
 * - Another line with a live subscription id and string name is one named
 *   event. Only an explicit `change` type is content; other types are `rename`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Parsed protocol discriminants route live ids; overflow retains unknown
 *   attribution and sync callbacks run before later lines from the same chunk.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One transport decoder selects lifecycle or event callbacks; subscription
 *   owners interpret scope without learning the JSON record representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Malformed and retired ids cannot revive watchers; overflow is delivered
 *   conservatively rather than suppressed to preserve cache hits.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and protocol list explain ordering and message precedence,
 *   following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral owners receive callback semantics while Linux-specific JSON
 *   framing and overflow translation remain in this native transport boundary.
 * @evidence contracts/performance.md#bound-retention-and-release-resources It ends a subscription the helper reports gone or refused, and keeps no state of its own.
 * @evidence contracts/performance.md#efficient-algorithms Parsing and temporary decoded fields follow line text length. Ordinary routing uses expected-constant id-map lookup; overflow snapshots S live subscriptions and invokes each once, using O(S) temporary references. Owner callbacks retain their own classification/lifecycle cost. Without overflow, retired or malformed ids do not trigger a population scan.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A line is an event delivered once; there is no computation to share.
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

import path from "node:path";

import { recordProjectChange } from "../recordProjectChange";
import { recordProjectMutation } from "../recordProjectMutation";
import type { WindowsProjectMutationBroker } from "./WindowsProjectMutationBroker";

/**
 * Apply one message from the isolated Windows watch process to the waiter or
 * tracker it names (samchon/ttsc#1387).
 *
 * The child multiplexes every Windows tracker of the process, and every drain,
 * over one ordered IPC channel, so each message carries the request id it
 * answers, and the decision is a table over what else it carries:
 *
 * - A malformed message, or one without an id, is ignored.
 * - A `drained` reply releases the drain waiting on that id. The channel is
 *   ordered, so every event the child sent before it has already been applied.
 * - A message for an id with no live registration is ignored. It is the late
 *   event of a tracker already closed.
 * - `failed` fails the tracker, and `ready` resolves its registration. One
 *   message can carry both, when some of the watches could not be opened.
 * - An event without a directory is a membership change the child could not
 *   attribute.
 * - An event names its directory by the child's canonical spelling, which is
 *   translated back to the walk's own spelling before anything compares it.
 *   With the exact-input trackers' classifier, that classifier alone decides
 *   between a mutation, a content change, and nothing. With the
 *   project-directory tracker's filters, a named event is a mutation when it
 *   can change membership, a content change when it can change a program
 *   input's content, and otherwise nothing. Any other event is a mutation.
 *
 * @param broker The drains and registrations of the broker the child serves.
 * @param message The message as the IPC channel delivered it.
 */
export function routeWindowsProjectMutationMessage(
  broker: Pick<WindowsProjectMutationBroker, "drains" | "trackers">,
  message: unknown,
): void {
  if (message === null || typeof message !== "object") return;
  const record = message as {
    directory?: string;
    drained?: boolean;
    failed?: boolean;
    filename?: string | null;
    eventType?: string;
    id?: number;
    ready?: boolean;
  };
  if (typeof record.id !== "number") return;
  if (record.drained === true) {
    const release = broker.drains.get(record.id);
    broker.drains.delete(record.id);
    release?.();
    return;
  }
  const registration = broker.trackers.get(record.id);
  if (registration === undefined) return;
  if (record.failed === true) registration.tracker.failed = true;
  if (record.ready === true) registration.ready();
  if (record.ready === true || record.failed === true) return;
  if (typeof record.directory !== "string") {
    registration.tracker.membershipChanged = true;
    return;
  }
  const reported =
    registration.spellings.get(record.directory) ?? record.directory;
  const filename = typeof record.filename === "string" ? record.filename : null;
  const changed = filename === null ? reported : path.join(reported, filename);
  if (registration.classify !== undefined) {
    const verdict = registration.classify(
      reported,
      filename,
      record.eventType ?? "rename",
    );
    if (verdict === "mutation") {
      recordProjectMutation(registration.tracker, changed);
    } else if (verdict === "change") {
      recordProjectChange(registration.tracker, changed);
    }
    return;
  }
  if (filename !== null && registration.membership !== undefined) {
    if (
      registration.membership(reported, filename) &&
      (record.eventType === "rename" ||
        registration.changeAddsMembership?.(reported, filename) === true)
    ) {
      recordProjectMutation(registration.tracker, changed);
      return;
    }
    if (
      record.eventType !== "rename" &&
      registration.content?.(reported, filename) === true
    ) {
      recordProjectChange(registration.tracker, changed);
    }
    return;
  }
  recordProjectMutation(registration.tracker, changed);
}

import type { WatchBroker } from "./WatchBroker";

/**
 * Apply one message from the isolated watch process to the waiter or
 * registration it names (samchon/ttsc#1387).
 *
 * The child multiplexes every registration of the process, and every drain,
 * over one ordered IPC channel, so each message carries the request id it
 * answers, and the decision is a table over what else it carries:
 *
 * - A malformed message, or one without an id, is ignored.
 * - A `drained` reply releases the drain waiting on that id. The channel is
 *   ordered, so every event the child sent before it has already been applied.
 *   Every draining registration the request covered is told which of its
 *   watches the child could not prove delivered (samchon/ttsc#1453), in its own
 *   spelling, or that none was unproven (samchon/ttsc#1546).
 * - A message for an id with no live registration is ignored. It is the late
 *   event of a registration already closed.
 * - `gap` says a native watch of the registration reported that events were
 *   dropped (samchon/ttsc#1425).
 * - `failed` says a watch of the registration failed, and `ready` resolves its
 *   wait. One message can carry both, when some of the watches could not be
 *   opened.
 * - An event without a directory is one the child could not place.
 * - Every other message is an event of a watched directory, named by the child's
 *   canonical spelling and translated back to the registration's own before its
 *   sink hears it.
 *
 * What each call means is the sink's to decide (`WatchBrokerSink`).
 *
 * @param broker The drains and registrations of the broker the child serves.
 * @param message The message as the IPC channel delivered it.
 * @evidence contracts/common.md#principled-implementation
 *   Message discriminants route exact request and registration ids; each drain
 *   snapshot determines which sinks may receive its partial-coverage verdict.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One IPC decoder translates canonical spellings and dispatches callbacks;
 *   sinks own mutation interpretation and request owners own release state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Malformed or retired registration events are ignored without inventing
 *   filenames; unknown event names remain null and failure stays explicit.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs, message list and parameter comments explain precedence,
 *   ordered delivery and owner spelling under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral consumers receive each registration's translated native spelling;
 *   canonical child paths are not compared by universal lowercase or alias prefix.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A drain reply releases the waiter it names, and a message for a closed registration is ignored; the function keeps no state of its own.
 * @evidence contracts/performance.md#efficient-algorithms A message is routed by id through Map lookups, and a drain reply visits the registrations once to hand each its verdict; no watched path is scanned.
 * @evidence contracts/performance.md#reuse-equivalent-work One child serves every registration over one channel, and each message is applied once to the waiter or registration it names.
 */
export function routeWatchBrokerMessage(
  broker: Pick<WatchBroker, "drainScopes" | "drains" | "registrations">,
  message: unknown,
): void {
  if (message === null || typeof message !== "object") return;
  const record = message as {
    directory?: string;
    drained?: boolean;
    unproven?: unknown;
    failed?: boolean;
    filename?: string | null;
    gap?: boolean;
    eventType?: string;
    id?: number;
    ready?: boolean;
  };
  if (typeof record.id !== "number") return;
  if (record.drained === true) {
    const release = broker.drains.get(record.id);
    if (release === undefined) return;
    const scope = broker.drainScopes?.get(record.id);
    if (scope === undefined) {
      broker.drains.delete(record.id);
      release(false);
      return;
    }
    // The reply is the whole verdict of this drain: a watch it does not name
    // was proven, so every draining registration hears a verdict, the empty
    // one where nothing of it is named.
    const unproven = new Map<number, Set<string>>();
    if (Array.isArray(record.unproven)) {
      for (const entry of record.unproven as unknown[]) {
        if (entry === null || typeof entry !== "object") continue;
        const { directory, id } = entry as {
          directory?: unknown;
          id?: unknown;
        };
        if (typeof id !== "number" || typeof directory !== "string") continue;
        const registration = broker.registrations.get(id);
        if (registration === undefined) continue;
        const directories = unproven.get(id) ?? new Set<string>();
        directories.add(registration.spellings.get(directory) ?? directory);
        unproven.set(id, directories);
      }
    }
    // Only a registration the request covered hears it. One registered after
    // the request was sent had no watch probed by it, and must keep waiting for
    // a drain of its own rather than read this one's silence as proof.
    for (const [id, registration] of broker.registrations) {
      if (!registration.drains) continue;
      if (!scope.has(id)) continue;
      registration.sink.unproven(unproven.get(id));
    }
    broker.drains.delete(record.id);
    release(true);
    return;
  }
  const registration = broker.registrations.get(record.id);
  if (registration === undefined) return;
  if (record.gap === true) {
    registration.sink.gap();
    return;
  }
  if (record.failed === true) registration.sink.failed();
  if (record.ready === true) registration.ready();
  if (record.ready === true || record.failed === true) return;
  if (typeof record.directory !== "string") {
    registration.sink.unattributed();
    return;
  }
  registration.sink.event(
    registration.spellings.get(record.directory) ?? record.directory,
    typeof record.filename === "string" ? record.filename : null,
    record.eventType ?? "rename",
  );
}

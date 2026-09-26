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
    const scope = broker.drainScopes?.get(record.id);
    for (const [id, registration] of broker.registrations) {
      if (!registration.drains) continue;
      if (scope !== undefined && !scope.has(id)) continue;
      registration.sink.unproven(unproven.get(id));
    }
    const release = broker.drains.get(record.id);
    broker.drains.delete(record.id);
    release?.(true);
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

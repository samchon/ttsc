import type { WatchBroker } from "./WatchBroker";

/**
 * Apply one message from the isolated watch process to the waiter or
 * registration it names (samchon/ttsc#1387).
 *
 * The child multiplexes every registration of the process, and every drain,
 * over one ordered IPC channel, so each message carries the request id it
 * answers, and the decision is a table over what else it carries:
 *
 * - A nonobject message or one without a numeric id is ignored. Remaining
 *   discriminants receive the checks below; this is not a complete schema
 *   validator for arbitrary foreign objects.
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
 * What each call means is the sink's to decide (`WatchBrokerSink`). Sink
 * exceptions propagate and can interrupt remaining dispatch/release work;
 * drain timeout and child lifetime belong to the request/broker owners.
 *
 * @param broker The drains and registrations of the broker the child serves.
 * @param message The message as the IPC channel delivered it.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Message discriminants route exact request and registration ids; each drain
 *   snapshot determines which sinks may receive its partial-coverage verdict.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One IPC decoder translates canonical spellings and dispatches callbacks;
 *   sinks own mutation interpretation and request owners own release state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Nonobject/nonnumeric-id and retired registration messages are ignored;
 *   nonstring filenames remain null and failure stays explicit. Producer
 *   eventType semantics are trusted when nonnull, rather than claiming a full
 *   arbitrary-message schema validation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs, message list and parameter comments explain precedence,
 *   ordered delivery and owner spelling under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral consumers receive each registration's translated native spelling;
 *   canonical child paths are not compared by universal lowercase or alias prefix.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Completed drain dispatch deletes its waiter and calls the owning release closure, which clears timeout/scope state and adjusts child references. Sink exceptions can interrupt this path; request timeout/failure handling remains separate. Temporary translated sets grow with unproven entries/spelling bytes, while this router retains no historical message or registration population.
 * @evidence contracts/performance.md#efficient-algorithms Ordinary messages use numeric-id lookup plus reached native-spelling text lookup/callback effects. Drain replies scan U unproven entries into translated sets and all R live registrations for covered draining sinks, not just covered scope size. Cost includes string hashing/comparison and delegated sink/release work; no native watched-directory enumeration occurs here.
 * @evidence contracts/performance.md#reuse-equivalent-work A supplied drain completion is distributed only to the request's covered draining registrations; deleting its waiter prevents duplicate replies from replaying that proof. Ordinary status/event invocations have no message deduplication. Child/probe computation sharing belongs to broker/drain owners, and this router does not independently validate the child's verdict.
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

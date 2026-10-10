import type { ChildProcess } from "node:child_process";

import type { WatchBrokerRegistration } from "./WatchBrokerRegistration";

/**
 * The live state of the isolated watch process.
 *
 * The broker multiplexes every Windows and macOS watch of the process over one
 * ordered transport, a tracker's and an input observer's scope's alike. Windows
 * uses the native helper's stdio; macOS uses Node IPC. Registrations and drains
 * are counted so the channel is referenced only while a reply is outstanding,
 * and each registration keeps the sink its messages go to and the spelling map
 * that translates the child's canonical paths back to its own.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Registration and request ids distinguish multiplexed owners; drain scopes
 *   preserve the exact coverage of each acknowledgment across concurrent opens.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This container exposes live protocol state to routing and lifecycle owners;
 *   tracker verdicts remain behind each registration's sink.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Coverage is represented explicitly instead of assuming a later registration
 *   shares an earlier drain or using process-wide silence as universal proof.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native type and separated member comments identify scope, reference counts
 *   and spelling ownership under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral consumers use sinks and translated spellings; native child and
 *   probe capability remain confined to this broker state boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   WatchBroker only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   WatchBroker only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   WatchBroker only declares a shape; it has no handle or retained state at
 *   runtime.
 */
export interface WatchBroker {
  /** The isolated watch process; unreferenced whenever no reply is outstanding. */
  child: ChildProcess;

  /**
   * Native stdio transport on Windows; absent for the macOS IPC broker and
   * explicit test transports.
   */
  transport?: {
    send(message: unknown): boolean;
    reference(active: boolean): void;
    close(): void;
  };

  /**
   * Round-trips awaiting the child's reply, by request id, each released with
   * whether the child answered it.
   */
  drains: Map<number, (answered: boolean) => void>;

  /**
   * The acknowledgement currently in flight, shared by every waiter whose
   * registration it covers.
   */
  draining?: Promise<boolean>;

  /**
   * The registrations each outstanding drain covers, by request id: those that
   * existed when its request was sent, and so were registered with the child
   * before the request reached it (samchon/ttsc#1546).
   */
  drainScopes?: Map<number, ReadonlySet<number>>;

  /** The registrations {@link draining} covers. */
  drainingScope?: ReadonlySet<number>;

  /** Next request id, shared by registrations and drains. */
  nextId: number;

  /**
   * Drain round-trips awaiting a reply; the channel stays referenced while
   * nonzero.
   */
  pendingDrains: number;

  /**
   * Registrations awaiting their ready reply; the channel stays referenced
   * while nonzero.
   */
  pendingRegistrations: number;

  /** Live registrations by id. */
  registrations: Map<number, WatchBrokerRegistration>;

  /**
   * Whether the child proves a stream through probes (samchon/ttsc#1453): its
   * backend is FSEvents, which delivers with a latency no turn of its loop
   * proves. Windows' backend never writes one, so no location names one there.
   */
  probes: boolean;
}

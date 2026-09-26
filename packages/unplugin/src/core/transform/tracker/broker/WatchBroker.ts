import type { ChildProcess } from "node:child_process";

import type { WatchBrokerRegistration } from "./WatchBrokerRegistration";

/**
 * The live state of the isolated watch process.
 *
 * The broker multiplexes every Windows and macOS watch of the process over one
 * IPC channel, a tracker's and an input observer's scope's alike. Registrations
 * and drains are counted so the channel is referenced only while a reply is
 * outstanding, and each registration keeps the sink its messages go to and the
 * spelling map that translates the child's canonical paths back to its own.
 */
export interface WatchBroker {
  /** The isolated watch process; unreferenced whenever no reply is outstanding. */
  child: ChildProcess;
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

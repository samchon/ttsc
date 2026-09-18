import type { ChildProcess } from "node:child_process";

import type { TtscProjectMutationTracker } from "../TtscProjectMutationTracker";

/**
 * The live state of the isolated Windows watch process.
 *
 * The broker multiplexes every Windows tracker of the process over one IPC
 * channel. Registrations and drains are counted so the channel is referenced
 * only while a reply is outstanding, and each tracker keeps the filters and the
 * spelling map it needs to translate the child's canonical paths back to the
 * spellings the rest of the adapter compares.
 */
export interface WindowsProjectMutationBroker {
  child: ChildProcess;
  /** Round-trips awaiting the child's reply, by request id. */
  drains: Map<number, () => void>;
  /** The acknowledgement currently in flight, shared by every waiter. */
  draining?: Promise<void>;
  nextId: number;
  pendingDrains: number;
  pendingRegistrations: number;
  trackers: Map<
    number,
    {
      /**
       * Whether one named event can be a program membership change. Present
       * only for the project-directory tracker, which watches whole directories
       * and so has to narrow what it hears; the trackers that watch exact names
       * have already narrowed theirs by construction.
       */
      membership?: (location: string, filename: string) => boolean;
      /** Whether one named event can change compiler-consumed content. */
      content?: (location: string, filename: string) => boolean;
      /** Classify a backend `change` that can add one unknown program path. */
      changeAddsMembership?: (location: string, filename: string) => boolean;
      ready: () => void;
      /**
       * The walk's own spelling for each canonical directory the child watches,
       * so a reported event can be translated back before anything compares it
       * with a path the walk or the configuration produced.
       *
       * Required, not optional. A registration that forgot it would fall back
       * to the child's canonical spelling and silently reintroduce the mismatch
       * this map exists to remove, with no type error and no failing test.
       */
      spellings: ReadonlyMap<string, string>;
      tracker: TtscProjectMutationTracker;
    }
  >;
}

import type { WatchBrokerSink } from "./WatchBrokerSink";

/**
 * One live registration of the isolated watch process: its watches' sink, and
 * what routing a message to it needs.
 */
export interface WatchBrokerRegistration {
  /**
   * Whether the registration takes part in drains, and so hears each drain's
   * verdict on its watches (`WatchBrokerSink.unproven`). A watch that only
   * forwards events, such as an input observer's scope, does not.
   */
  drains: boolean;
  /** Resolve the registration's wait for its watches to open. */
  ready: () => void;
  /** Where the registration's messages go. */
  sink: WatchBrokerSink;
  /**
   * The registration's own spelling for each canonical directory the child
   * watches, so a reported event is translated back before anything compares it
   * with a path the registration produced.
   *
   * Required, not optional. A registration that forgot it would fall back to
   * the child's canonical spelling and silently reintroduce the mismatch this
   * map exists to remove, with no type error and no failing test.
   */
  spellings: ReadonlyMap<string, string>;
}

/**
 * What one registration of the isolated watch process is told
 * (samchon/ttsc#1387): the events of its watches, and what befell the watches
 * themselves.
 *
 * `routeWatchBrokerMessage` decides which call a message is, and translates the
 * child's canonical directory back to the spelling the registration watched
 * under, so a sink compares what it hears against its own paths. A sink decides
 * only what the call means to its owner: a tracker records a witness or a flag
 * (`brokeredTrackerSink`), and an input observer's scope hands the event on
 * (`openIsolatedRecursiveWatch`). Neither needs the other's shape.
 */
export interface WatchBrokerSink {
  /**
   * One event below a watched directory.
   *
   * @param directory The watched directory, in the registration's spelling.
   * @param filename The entry the event names, relative to `directory`, or
   *   `null` when the backend could not name it, which may then concern
   *   anything below the directory (a Windows buffer overflow).
   * @param eventType `"rename"` or `"change"`, as `fs.watch` names them.
   */
  event(directory: string, filename: string | null, eventType: string): void;
  /** An event the child could not place under any watched directory. */
  unattributed(): void;
  /** A watch of the registration failed or could not be opened. */
  failed(): void;
  /**
   * A native watch of the registration reported that events were dropped, so
   * some may have been lost (samchon/ttsc#1425).
   */
  gap(): void;
  /**
   * A drain's verdict on the registration's watches (samchon/ttsc#1453): the
   * directories whose stream could not be proven to have delivered, in the
   * registration's spelling, or `undefined` when every one was proven. Only a
   * registration that drains is told.
   */
  unproven(directories: ReadonlySet<string> | undefined): void;
}

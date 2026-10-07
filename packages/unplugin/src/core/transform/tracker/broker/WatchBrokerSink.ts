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
 *
 * @evidence contracts/common.md#principled-implementation
 *   Events, failed registration, dropped delivery and per-location proof loss
 *   remain independent messages with distinct authority consequences.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One callback interface separates routing from owner interpretation; trackers
 *   and forwarding observers do not depend on each other's state representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Lost attribution and delivery are explicit instead of invented filenames
 *   or silently successful watcher states.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and separated callback comments explain message meaning
 *   and spelling ownership under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral consumers hear paths in their own registration spelling while
 *   native canonicalization and drop signaling remain with routing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   WatchBrokerSink only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   WatchBrokerSink only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   WatchBrokerSink only declares a shape; it has no handle or retained state
 *   at runtime.
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
   * @evidence contracts/common.md#principled-implementation
   *   Relative names and a nullable unknown name preserve event attribution.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One callback carries observation without choosing the owner's input scope.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   A backend overflow remains null instead of a fabricated exact path.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native parameter comments define spelling and null breadth under the
   *   documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   OS-neutral owners receive translated directory spelling and native unknown
   *   names without platform-wide path casing assumptions.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of event is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of event is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of event is declared here; the cost belongs to its
   *   implementation.
   */
  event(directory: string, filename: string | null, eventType: string): void;

  /**
   * An event the child could not place under any watched directory.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Attribution loss is represented independently of named events and failure.
   * @evidence contracts/common.md#clear-and-simple-design
   *   A parameterless callback carries exactly the unavailable-attribution fact.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The owner is told uncertainty rather than an arbitrary guessed directory.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc names the attribution limit under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   OS-neutral owners receive unknown attribution without guessing a native
   *   path from the operating system or stream backend.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of unattributed is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of unattributed is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of unattributed is declared here; the cost belongs to
   *   its implementation.
   */
  unattributed(): void;

  /**
   * A watch of the registration failed or could not be opened.
   *
   * @evidence contracts/common.md#principled-implementation
   *   This terminal coverage failure is distinct from an observed mutation.
   * @evidence contracts/common.md#clear-and-simple-design
   *   A parameterless callback lets the owner withdraw its own authority.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Registration failure cannot be represented as successfully quiet coverage.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc includes both opening and later failure under the
   *   documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   OS-neutral owners handle the failure contract without inspecting native
   *   stream, descriptor or child-process details.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of failed is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of failed is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of failed is declared here; the cost belongs to its
   *   implementation.
   */
  failed(): void;

  /**
   * A native watch of the registration reported that events were dropped, so
   * some may have been lost (samchon/ttsc#1425).
   *
   * @evidence contracts/common.md#principled-implementation
   *   A drop notification withdraws completeness without ending future delivery.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One callback reports the gap independently of failure or exact event paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Missing events cannot be silently ignored to preserve a quiet-state proof.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc identifies the native dropped-event meaning under the
   *   documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   OS-neutral owners consume explicit native loss capability instead of
   *   assuming all watcher backends have equivalent delivery guarantees.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of gap is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of gap is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of gap is declared here; the cost belongs to its
   *   implementation.
   */
  gap(): void;

  /**
   * A drain's verdict on the registration's watches (samchon/ttsc#1453): the
   * directories whose stream could not be proven to have delivered, in the
   * registration's spelling, or `undefined` when every one was proven. Only a
   * registration that drains is told.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The optional directory Set expresses partial drain coverage in owner
   *   spelling; undefined means no location remained unproven for that request.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One scoped verdict callback keeps partial coverage separate from events.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   A drain cannot claim locations outside its registration coverage or replace
   *   missing native proof with a guessed fixed delay.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc states Set, undefined and drain-participation meanings under
   *   the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   OS-neutral owners receive translated unproven locations rather than
   *   applying FSEvents-specific latency assumptions themselves.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of unproven is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of unproven is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of unproven is declared here; the cost belongs to its
   *   implementation.
   */
  unproven(directories: ReadonlySet<string> | undefined): void;
}

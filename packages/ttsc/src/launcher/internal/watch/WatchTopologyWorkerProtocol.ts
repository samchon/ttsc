import type { PluginContentIdentities } from "../../../plugin/internal/source/PluginContentIdentities";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { WatchInputChange } from "./WatchInputChange";
import type { WatchTopology } from "./WatchTopology";

/**
 * Cloned requests and ordered notifications of one watch topology worker.
 *
 * @evidence contracts/common.md#principled-implementation Discriminated messages preserve operation arguments and separate callbacks from request completion; bigint reference maps retain the record store's separability evidence through structured cloning.
 * @evidence contracts/common.md#clear-and-simple-design One internal protocol serves the facade and its worker without transferring callback functions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Messages carry actual topology operations and observations rather than predicted decisions.
 * @evidence contracts/common.md#meaningful-documentation Members identify correlation, callback ordering and the cloneable option boundary.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The types describe structured messages; execution owns native paths and workers.
 * @evidenceExclude contracts/performance.md#efficient-algorithms These types execute no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The protocol grants no result reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The types acquire no resources; the facade owns in-flight messages.
 */
export namespace WatchTopologyWorkerProtocol {
  /**
   * Only the core's selected data options cross the worker boundary.
   *
   * @evidence contracts/common.md#principled-implementation Deriving the data type from the core constructor keeps option meaning with its owner.
   * @evidence contracts/common.md#clear-and-simple-design One alias serves both ends of the worker's startup payload.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The facade explicitly selects these fields without transferring invocation callbacks.
   * @evidence contracts/common.md#meaningful-documentation Prose identifies the cloneable startup boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This alias executes no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The alias chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type grants no reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The type acquires no resource; the facade owns startup cloning.
   */
  export type Options = ConstructorParameters<typeof WatchTopology>[0];

  /**
   * Callback implementations remain on the launcher thread.
   *
   * @evidence contracts/common.md#principled-implementation Core callbacks retain their meanings; actual worker error or unexpected exit invokes separate terminal notification because authority was lost, requiring the launcher to retire its session.
   * @evidence contracts/common.md#clear-and-simple-design One structural intersection adds a dedicated terminal callback beside recoverable subscription events.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Callbacks report actual observations and authority loss without continuing to claim coverage after thread death.
   * @evidence contracts/common.md#meaningful-documentation Prose identifies launcher-thread callbacks and the receiving owner's required retirement after terminal loss.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation These signatures perform no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Callback signatures choose no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Callback declarations grant no event reuse; terminal failure belongs to one lifecycle.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Signatures acquire no resources; callback implementations own session retention and cleanup.
   */
  export type Callbacks = ConstructorParameters<typeof WatchTopology>[1] & {
    /**
     * Terminal thread loss requires the launcher to retire its watch session.
     */
    onFailure(error: unknown): void;
  };

  /**
   * An operation carries only the arguments its core member consumes.
   *
   * @evidence contracts/common.md#principled-implementation Discriminated method names pair each actual operation with its required payload.
   * @evidence contracts/common.md#clear-and-simple-design One union describes the core's five transport operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Publications retain complete input snapshots and source proof stores without filtering.
   * @evidence contracts/common.md#meaningful-documentation Prose identifies argument ownership and discriminated payloads.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The union executes no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The type chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The payload grants no result reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Transport and core owners retain cloned payloads rather than this type.
   */
  export type Operation =
    | { method: "refresh"; notify: boolean }
    | {
        method: "setExtraInputs";
        inputs: readonly string[];
        identities?: PluginContentIdentities.Store;
      }
    | { method: "setProjectInputs"; inputs: ITtscProjectInputSnapshot }
    | { method: "whenIdle" }
    | { method: "close" };

  /**
   * Each operation receives its own correlated completion or failure.
   *
   * @evidence contracts/common.md#principled-implementation A per-facade monotonic id distinguishes concurrent pending operations.
   * @evidence contracts/common.md#clear-and-simple-design Correlation is one field intersected with the operation union.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An id identifies the actual request rather than an assumed ordered result.
   * @evidence contracts/common.md#meaningful-documentation Prose states correlation and terminal outcomes.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The representation performs no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This type runs no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Request identity grants no reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The facade owns pending correlation entries.
   */
  export type Request = { id: number } & Operation;

  /**
   * Callbacks and answers use one FIFO port, preserving their causal order.
   *
   * @evidence contracts/common.md#principled-implementation Event tags distinguish callbacks from correlated success or failure, and one MessagePort orders callback transmission before operation completion.
   * @evidence contracts/common.md#clear-and-simple-design One union carries observed changes, coverage reports, recoverable errors and request outcomes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failures retain serialized causes and actual observed input paths; no expected response replaces them.
   * @evidence contracts/common.md#meaningful-documentation Prose states causal FIFO ordering.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The union describes portable message data without a native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The type chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each message belongs to its actual event or operation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Message and correlation retention belongs to worker and facade implementations.
   */
  export type Reply =
    | { id: number; ok: true }
    | { id: number; ok: false; error: unknown }
    | { event: "input"; change: WatchInputChange }
    | { event: "topology" }
    | { event: "error"; location: string; error: unknown }
    | { event: "roots" | "unavailable"; roots: readonly string[] };
}

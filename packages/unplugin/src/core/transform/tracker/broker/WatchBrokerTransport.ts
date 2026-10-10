import type { WatchBroker } from "./WatchBroker";

/**
 * Common lifecycle seam for the native Windows stdio broker and macOS IPC.
 *
 * The transport owns framing and demand references only. Ordered native
 * notifications and per-registration readiness remain backend responsibilities;
 * a successful send cannot certify coverage or cache reuse.
 *
 * @evidence contracts/common.md#principled-implementation One transport seam preserves explicit failure and reference ownership for both supported broker backends.
 * @evidence contracts/common.md#clear-and-simple-design Callers express send, demand and retirement through this namespace instead of duplicating platform checks or modifying a ChildProcess.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported child streams and IPC APIs are used without replacing runtime methods.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates transport completion from native watch authority.
 * @evidence contracts/portability.md#os-neutral-implementation Native selection stays at broker startup; all tracker and observer consumers share these operations.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Member operations own their delegated cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The broker owner selects transport and sharing lifetime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This namespace itself retains no transport registry.
 */
export namespace WatchBrokerTransport {
  /**
   * Queue a message on the selected transport. False refuses delivery; true
   * only means queued, with actual acknowledgment or failure still
   * outstanding.
   *
   * @evidence contracts/common.md#principled-implementation Native and IPC transports preserve separate queue acceptance and observed backend replies.
   * @evidence contracts/common.md#clear-and-simple-design One selection delegates framing to the startup-owned transport.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No queue result is upgraded into readiness or a native drain.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the limited meaning of the returned boolean.
   * @evidence contracts/portability.md#os-neutral-implementation Explicit stdio capability takes precedence over optional IPC.
   * @evidence contracts/performance.md#efficient-algorithms Transport selection is fixed work; JSON framing, message bytes and pipe backpressure belong to the selected sender.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Sending an effect does not own computation reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selected sender and request owner retain queued bytes and outstanding acknowledgment state.
   */
  export function send(broker: WatchBroker, message: unknown): boolean {
    return broker.transport === undefined
      ? broker.child.send?.(message as object) === true
      : broker.transport.send(message);
  }

  /**
   * Keep the selected reply channel live exactly while caller demand exists.
   * Counts belong to registration/drain owners; native references are flags.
   *
   * @evidence contracts/common.md#principled-implementation Outstanding requests retain both process and reply channel, preventing host exit before acknowledgment.
   * @evidence contracts/common.md#clear-and-simple-design One operation applies the caller's aggregated demand to either transport.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional Bun IPC methods are used as capabilities without installing replacements.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies count ownership and flag semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Optional IPC methods and a selected native pipe capability express runtime differences.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Reference toggling selects no data-processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This effect owns no shared computation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller supplies aggregate demand; removing the last demand unreferences process and reply channel without asserting native termination.
   */
  export function reference(broker: WatchBroker, active: boolean): void {
    if (broker.transport !== undefined) broker.transport.reference(active);
    else if (active) {
      broker.child.ref();
      broker.child.channel?.ref?.();
    } else {
      broker.child.unref();
      broker.child.channel?.unref?.();
    }
  }

  /**
   * End this broker's request stream. The last-registration owner separately
   * attempts process termination; closing a channel is not proof of child
   * exit.
   *
   * @evidence contracts/common.md#principled-implementation Channel retirement is distinct from process exit and native resource closure.
   * @evidence contracts/common.md#clear-and-simple-design Startup-owned transport closes its request stream without platform checks in consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported end/disconnect operations preserve native ownership without synthetic exit acknowledgment.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the independent termination attempt and limited closure meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Selected stream closure and optional IPC disconnection keep platform details behind the transport seam.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Closing one channel selects no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Retirement owns no computation reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The selected transport ends its input; process kill and actual native cleanup remain the broker and backend's responsibilities.
   */
  export function close(broker: WatchBroker): void {
    if (broker.transport !== undefined) broker.transport.close();
    else broker.child.disconnect?.();
  }
}

import type { HostWatchBridge } from "../bridge/HostWatchBridge";

/**
 * Tell a watching webpack or Rspack compiler's bridge which project records the
 * compile that just ended depends on (`HostWatchBridge.compiled`), read from
 * the compilation's own file dependencies.
 *
 * The host's completed-compilation dependency collection determines which
 * registered records its watcher is expected to hear. The bridge suspends
 * repeated moves for records absent from that collection; input observation and
 * owed signals remain. A reintroduced watched record with an owed signal can
 * resume signaling. This report does not prove a generation's inputs or
 * acknowledge that a signal has been answered.
 *
 * Membership uses the host collection's native record spelling exactly. Its
 * inclusion of restored modules' dependencies is a host premise, not a
 * filesystem/watch-delivery proof supplied by this adapter.
 *
 * @param bridge The session's bridge, when one is open.
 * @param dependencies The ended compilation's `fileDependencies`: a set of
 *   absolute paths, or any iterable of them.
 * @evidence contracts/common.md#principled-implementation Actual dependency membership marks host-watched records for the bridge's repeated-signal policy; it does not certify generation proof or answer owed signals.
 * @evidence contracts/common.md#clear-and-simple-design The adapter passes one membership predicate to the existing bridge; it creates a Set only when the iterable lacks a lookup operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual dependency collection decides acknowledgment, without target-name exceptions or a synthetic success when the bridge is absent.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes host dependency membership, suspended repeated moves, retained observation/owed signals and the host cache premise.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native absolute record spellings pass unchanged to the host has operation
 *   or exact Set membership. No case/URL/slash rewrite or physical alias claim
 *   substitutes for the dependency representation the host actually supplied.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A supplied has operation avoids copying N dependencies; otherwise one
 *   Set materializes them. Delegated compiled checks R registered records,
 *   with native spelling/host lookup costs and possible signal/timer work
 *   when previously unwatched owed records rejoin. Missing bridge does no work.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   All record queries in this report share one supplied has operation or
 *   materialized dependency Set. A later compilation supplies a new population;
 *   no cross-compilation index is retained from this report.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The membership closure/optional Set are synchronous call-local state.
 *   Bridge-owned unwatched/owed state and signaling timers stay with its owner;
 *   this adapter acquires no retained handle/task.
 */
export function reportCompiledProjectRecords(
  bridge: HostWatchBridge | undefined,
  dependencies: Iterable<string> & { has?(file: string): boolean },
): void {
  if (bridge === undefined) return;
  const depends =
    typeof dependencies.has === "function"
      ? (file: string) => dependencies.has!(file)
      : (() => {
          const files = new Set(dependencies);
          return (file: string) => files.has(file);
        })();
  bridge.compiled(depends);
}

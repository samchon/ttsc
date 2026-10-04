import type { HostWatchBridge } from "../bridge/HostWatchBridge";
import type { RollupCachedModuleProof } from "./RollupCachedModuleProof";

/**
 * Request cached-module transformation while the bridge owes a signal, or when
 * the module proof reports movement. Return null to leave the host's ordinary
 * cache decision in place. An owed signal skips module proof evaluation.
 * This protocol decision does not establish arrival of a native watch event.
 *
 * @evidence contracts/common.md#principled-implementation Only an exactly true owed-state answer bypasses module judgment; otherwise the existing moved predicate decides true versus null using the supplied module.
 * @evidence contracts/common.md#clear-and-simple-design One production-used decision maps the bridge and module-proof owners' answers to the shared Vite/Rollup hook protocol without duplicating their validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated watch state or cache entry replaces those owners' answers; method receivers and exceptions are preserved.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains true/null meaning, short-circuiting and the native-event acquisition limit.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This decision performs no native path interpretation, filesystem access or capability determination; bridge observation and module-record identity remain with their supplied owners.
 * @evidence contracts/performance.md#efficient-algorithms A true owed answer avoids module proof work. Otherwise one delegated moved judgment may filter module text, derive current option identity or observe/prove its record through the owner's per-pass tables; the fixed branch does not make that delegated work constant cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The decision is evaluated for each hook request; bridge state and qualified per-pass proof reuse belong to their owners, not a cache in this operation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This operation acquires or retains no watcher, record table or generation; it borrows the two owners for one judgment.
 */
export function selectRollupCachedModuleTransform(
  bridge: Pick<HostWatchBridge, "owes"> | undefined,
  cachedModules: Pick<RollupCachedModuleProof, "moved">,
  module: Parameters<RollupCachedModuleProof["moved"]>[0],
): true | null {
  return bridge?.owes() === true || cachedModules.moved(module) ? true : null;
}

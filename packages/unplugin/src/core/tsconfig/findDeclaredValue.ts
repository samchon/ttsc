import { TsconfigReadTransaction } from "./TsconfigReadTransaction";

/**
 * Find the nearest selected value and its lexical declaring directory.
 *
 * Own declarations win, then later extends entries are searched first. Paths
 * remain anchored at the named config; physical identity only cuts branch
 * cycles. Independent aliases can therefore resolve different relative bases.
 * Missing or malformed configs remain best-effort absence; the compiler owns
 * configuration diagnostics. Unresolved file candidates remain observed inputs.
 *
 * A supplied transaction shares source, identity and edge observations across
 * keys. A decoded-source map remains supported for callers that own that map;
 * its graph/selection work is scoped to this query. Neither may outlive its
 * caller's independent freshness observation without input validation.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared evaluator searches own then reverse-priority bases and returns
 *   the lexical declaring anchor. Wrapping selected values preserves null as
 *   an actual selector value, distinct from an undefined absence.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter keeps selector validity separate from contextual inheritance;
 *   the transaction owns graph observations, cycle guards and completed answers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Missing sources stay unproven and their file candidates remain observed.
 *   No consumer-specific declaration or physical alias merging supplies values.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain precedence, lexical anchors, error ownership and
 *   the difference between a shared transaction and a decoded-source map.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The transaction uses native lexical paths and actual realpath cycle
 *   identities; host resolution owns file and package specifier spelling.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The transaction memoizes selected and absent answers by lexical node and
 *   relevant ancestry context. Acyclic shared subgraphs select once per node;
 *   source/identity witness unions and checks follow accumulated subtree volume.
 *   Selector cost and native source/edge/path observations remain additional.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The supplied transaction shares observations across queries; query-local
 *   memo entries reuse only the same selector and matching physical ancestry
 *   intersections. A subsequent independent read constructs a fresh owner.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Query state is synchronous and local; the optional transaction and source
 *   collection remain caller-owned. No handle or cross-call state is acquired.
 */
export function findDeclaredValue<T>(
  tsconfig: string,
  select: (parsed: object) => T | undefined,
  seen: Set<string>,
  /** Accumulated input observations, separate from branch-cycle ancestry. */
  collect?: Set<string>,
  configs?: Map<string, unknown> | TsconfigReadTransaction,
): { baseDir: string; value: T } | null {
  const transaction =
    configs instanceof TsconfigReadTransaction
      ? configs
      : new TsconfigReadTransaction(configs);
  const declared = transaction.find(
    tsconfig,
    (parsed) => {
      const value = select(parsed);
      return value === undefined ? undefined : { value };
    },
    seen,
    collect,
  );
  return declared === null
    ? null
    : { baseDir: declared.baseDir, value: declared.value.value };
}

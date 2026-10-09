import path from "node:path";

import { TsconfigReadTransaction } from "./TsconfigReadTransaction";

/**
 * Resolve effective files/include/exclude lists with their lexical origins.
 *
 * Own key presence masks inherited lists, including null and invalid values.
 * Without an own key, the last inherited array wins; an inherited non-array
 * does not erase an earlier array (TypeScript-Go's applyExtendedConfig).
 * Non-string elements are removed from specs and retained in rawSpecs so
 * generated overlays preserve compiler diagnostics. Relative entries remain
 * anchored at the named declaring config, including independent link aliases.
 *
 * @returns The list and its directory, undefined when no array is selected, or
 *   null when the root config cannot be read as an object. A supplied transaction
 *   belongs to this freshness observation; later reads require a fresh owner.
 * @evidence contracts/common.md#principled-implementation
 *   Own invalid values stop inheritance at that node. Forward inherited
 *   traversal keeps the last array and ignores empty selections, preserving
 *   the compiler's distinct own-null and inherited-null rules and lexical origin.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter owns list validity and raw/usable projections. The transaction
 *   owns shared inheritance, physical cycle decisions and ordered input replay.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   List differences follow compiler merge semantics. Missing candidates remain
 *   observed, and invalid elements survive in rawSpecs for compiler diagnostics.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain precedence, origin and raw elements; returns
 *   documentation distinguishes unreadable roots from absent usable arrays.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native lexical config directories anchor specs; transaction realpaths only
 *   guard cycles, and host resolver/candidate APIs own native file/package lookup.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Query memoization avoids repeating acyclic shared subgraphs, including
 *   absent lists. Filtering/copying follows declared list length; ordered source
 *   and identity witness unions/checks follow accumulated subtree volume and
 *   changed cycle contexts require re-evaluation. Native observations are shared.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   A supplied transaction shares source, failed reads, identity and edge
 *   observations across keys. List selections share only matching ancestry
 *   intersections within this query. Independent freshness reads use new owners.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The synchronous query releases its memo after return; the transaction and
 *   optional observed-source set belong to the caller. No handle is retained.
 */
export function findDeclaredFileSpecs(
  tsconfig: string,
  key: "files" | "include" | "exclude",
  collect?: Set<string>,
  configs?: Map<string, unknown> | TsconfigReadTransaction,
):
  | { baseDir: string; specs: string[]; rawSpecs: readonly unknown[] }
  | undefined
  | null {
  const resolved = path.resolve(tsconfig);
  collect?.add(resolved);
  const transaction =
    configs instanceof TsconfigReadTransaction
      ? configs
      : new TsconfigReadTransaction(configs);
  const root = transaction.read(resolved);
  if (root === null || Array.isArray(root)) return null;
  const declared = transaction.find(
    resolved,
    (parsed) => {
      if (Array.isArray(parsed)) return null;
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) return undefined;
      const value = (parsed as Record<string, unknown>)[key];
      return Array.isArray(value)
        ? {
            rawSpecs: value.slice(),
            specs: value.filter(
              (entry): entry is string => typeof entry === "string",
            ),
          }
        : null;
    },
    new Set(),
    collect,
    "last",
  );
  return declared === null
    ? undefined
    : { baseDir: declared.baseDir, ...declared.value };
}

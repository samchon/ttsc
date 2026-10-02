import { isBuiltin } from "node:module";

import type { ResolveResult } from "./ResolveResult";

/**
 * Restore a `node:` builtin URL when affected Node releases return the exact
 * prefix-stripped spelling from their synchronous CommonJS resolver.
 *
 * Every other result passes through unchanged. In particular, a user hook that
 * intentionally remaps a `node:` specifier to another URL retains ownership of
 * that mapping, while ordinary and ESM builtin results already carrying the
 * scheme avoid an unnecessary copy.
 *
 * @evidence contracts/common.md#principled-implementation Restoration requires a real builtin, an explicit node: request and the exact stripped result; any other mapping remains owned by the resolver that produced it.
 * @evidence contracts/common.md#clear-and-simple-design One result adapter isolates the documented synchronous CommonJS scheme difference without rerunning resolution or duplicating builtin tables.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The compatibility path addresses an actual supported Node result shape through isBuiltin; it neither overrides intentional user remaps nor patches a foreign resolver.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain exact restoration scope, user-hook ownership and unchanged ESM/builtin results.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns the supplied result or one shallow copy and retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A constant number of string comparisons; there is no loop.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure function of its two arguments with nothing to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares specifier and URL strings and checks isBuiltin; it builds no path and touches no filesystem.
 */
export function restoreStrippedNodeBuiltinScheme(
  specifier: string,
  result: ResolveResult,
): ResolveResult {
  return isBuiltin(specifier) &&
    specifier.startsWith("node:") &&
    result.url === specifier.slice("node:".length)
    ? { ...result, url: specifier }
    : result;
}

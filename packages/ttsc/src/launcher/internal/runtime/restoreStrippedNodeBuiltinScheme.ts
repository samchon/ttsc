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

import assert from "node:assert/strict";

import { TestMetroRuntime } from "./metro-runtime";

/**
 * A stub upstream transformer tagged with the module specifier that produced
 * it.
 */
function tagged(name: string): {
  transform: (params: unknown) => Promise<{ ast: { name: string } }>;
} {
  return { transform: async () => ({ ast: { name } }) };
}

async function nameOf(upstream: {
  transform: (params: unknown) => Promise<{ ast: { name: string } }>;
}): Promise<string> {
  const result = await upstream.transform({
    src: "",
    filename: "",
    options: {},
  });
  return result.ast.name;
}

/**
 * Asserts auto-detection tries the candidates in priority order (Expo → modern
 * RN → legacy RN): the first resolvable candidate wins, and removing earlier
 * ones falls through to the next.
 */
export async function assertAutoDetectsInPriorityOrder(): Promise<void> {
  const { resolveUpstreamTransformer, UPSTREAM_CANDIDATES } =
    await TestMetroRuntime.loadUpstream();
  const [expo, rn, legacy] = UPSTREAM_CANDIDATES as readonly string[];

  // All available → Expo (first) wins.
  assert.equal(
    await nameOf(
      resolveUpstreamTransformer(undefined, (p: string) => tagged(p)),
    ),
    expo,
  );
  // Expo missing → modern RN.
  assert.equal(
    await nameOf(
      resolveUpstreamTransformer(undefined, (p: string) =>
        p === expo ? undefined : tagged(p),
      ),
    ),
    rn,
  );
  // Expo + modern RN missing → legacy.
  assert.equal(
    await nameOf(
      resolveUpstreamTransformer(undefined, (p: string) =>
        p === expo || p === rn ? undefined : tagged(p),
      ),
    ),
    legacy,
  );
}

/**
 * Asserts auto-detection throws a clear error when no upstream transformer can
 * be resolved at all.
 */
export async function assertThrowsWhenNoUpstreamInstalled(): Promise<void> {
  const { resolveUpstreamTransformer } = await TestMetroRuntime.loadUpstream();
  assert.throws(
    () => resolveUpstreamTransformer(undefined, () => undefined),
    /Could not find an upstream Metro transformer/,
  );
}

/**
 * Asserts an empty-string `customPath` is treated as "not configured" and falls
 * through to auto-detection rather than attempting to resolve `""`.
 */
export async function assertEmptyCustomPathFallsBackToAutoDetect(): Promise<void> {
  const { resolveUpstreamTransformer, UPSTREAM_CANDIDATES } =
    await TestMetroRuntime.loadUpstream();
  assert.equal(
    await nameOf(resolveUpstreamTransformer("", (p: string) => tagged(p))),
    (UPSTREAM_CANDIDATES as readonly string[])[0],
  );
}

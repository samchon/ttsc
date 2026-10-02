import assert from "node:assert/strict";

import type { UpstreamTransformer } from "../../../../packages/metro/src/core/UpstreamTransformer";
import * as upstream from "../../../../packages/metro/src/core/upstream";

/** Run `fn`, returning the error it throws (fails the test if it does not). */
function captureThrow(fn: () => unknown): Error {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  return assert.fail("expected the call to throw") as never;
}

/** Escape a literal string for embedding in a `RegExp`. */
function escapeRegExp(literal: string): RegExp {
  return new RegExp(literal.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"));
}

/** Walk the `cause` chain, collecting every message it exposes. */
function messageChain(error: Error): string {
  let text = error.message;
  let cause: unknown = (error as { cause?: unknown }).cause;
  while (cause instanceof Error) {
    text += `\n${cause.message}`;
    cause = (cause as { cause?: unknown }).cause;
  }
  return text;
}

/**
 * A stub upstream transformer tagged with the module specifier that produced
 * it.
 */
function tagged(name: string): {
  transform: (params: unknown) => Promise<{ ast: { name: string } }>;
} {
  return { transform: async () => ({ ast: { name } }) };
}

async function nameOf(value: UpstreamTransformer): Promise<string> {
  const result = await value.transform({
    src: "",
    filename: "",
    options: {},
  });
  return (result.ast as { name: string }).name;
}

/**
 * Asserts auto-detection tries the candidates in priority order (Expo → modern
 * RN → legacy RN): the first resolvable candidate wins, and removing earlier
 * ones falls through to the next.
 */
export async function assertAutoDetectsInPriorityOrder(): Promise<void> {
  const { resolveUpstreamTransformer } = upstream;
  const [expo, rn, legacy] = [
    "@expo/metro-config/babel-transformer",
    "@react-native/metro-babel-transformer",
    "metro-react-native-babel-transformer",
  ];

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
  const { resolveUpstreamTransformer } = upstream;
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
  const { resolveUpstreamTransformer } = upstream;
  assert.equal(
    await nameOf(resolveUpstreamTransformer("", (p: string) => tagged(p))),
    "@expo/metro-config/babel-transformer",
  );
}

/**
 * Asserts auto-detection does NOT fall through to a later candidate when an
 * earlier, resolvable candidate throws during initialization. A broken Expo
 * install must surface, not silently select the legacy React Native
 * transformer.
 */
export async function assertAutoDetectInitFailureDoesNotFallThrough(): Promise<void> {
  const { resolveUpstreamTransformer } = upstream;
  const expo = "@expo/metro-config/babel-transformer";
  const legacy = "metro-react-native-babel-transformer";
  const failure = new Error("expo transformer boom");
  const error = captureThrow(() =>
    resolveUpstreamTransformer(undefined, (p: string) => {
      if (p === expo) {
        throw failure;
      }
      return tagged(p);
    }),
  );
  // Surfaces the first candidate's failure with its cause...
  assert.match(messageChain(error), /expo transformer boom/);
  assert.match(error.message, escapeRegExp(expo));
  const cause = (error as { cause?: unknown }).cause;
  assert.ok(cause instanceof Error, "original error is attached as `cause`");
  assert.equal(cause, failure, "the original failure identity is preserved");
  // ...and it is not the terminal "install one of these" message, i.e. it did
  // not fall through to (and fail past) the legacy candidate.
  assert.doesNotMatch(
    error.message,
    /Could not find an upstream Metro transformer/,
  );
  assert.doesNotMatch(error.message, escapeRegExp(legacy));
}

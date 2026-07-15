import assert from "node:assert/strict";

import { TestMetroRuntime } from "./metro-runtime";

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

/**
 * Asserts an explicit configured path that genuinely does not resolve is
 * reported as absence ("could not load"), NOT as an initialization failure, on
 * the PRODUCTION path. This exercises the real `require.resolve` →
 * `MODULE_NOT_FOUND` → undefined branch of `tryRequire` (no injected seam), the
 * negative twin of the init-failure cases: a resolution failure of the
 * requested specifier stays a plain absence.
 */
export async function assertAbsentConfiguredPathReportsNotLoaded(): Promise<void> {
  const { resolveUpstreamTransformer } = await TestMetroRuntime.loadUpstream();
  const error = captureThrow(() =>
    resolveUpstreamTransformer("@@ttsc-metro-absent-candidate@@"),
  );
  assert.match(
    error.message,
    /Could not load the configured upstream transformer/,
  );
  // Absence is not wrapped as an initialization failure and carries no cause.
  assert.doesNotMatch(error.message, /failed to (load|initialize)/i);
  assert.equal((error as { cause?: unknown }).cause, undefined);
}

/**
 * Asserts an explicit configured path that resolves to an installed package but
 * whose requested subpath is NOT exported is reported as absence ("could not
 * load"), NOT as an initialization failure, on the PRODUCTION path. Node throws
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` (not `MODULE_NOT_FOUND`) during resolution for
 * such a specifier; because resolution never executes the module, this proves
 * the requested candidate entry point is unavailable, so it must stay a plain
 * absence — the boundary that keeps auto-detection falling through under
 * Expo/React Native version skew instead of hard-failing. `typescript` is a
 * stable devDependency with an `exports` map, so a bogus subpath of it triggers
 * the code deterministically.
 */
export async function assertUnexportedSubpathReportsNotLoaded(): Promise<void> {
  const { resolveUpstreamTransformer } = await TestMetroRuntime.loadUpstream();
  const error = captureThrow(() =>
    resolveUpstreamTransformer("typescript/@@ttsc-metro-absent-subpath@@"),
  );
  assert.match(
    error.message,
    /Could not load the configured upstream transformer/,
  );
  // A non-exported subpath is absence, not a wrapped initialization failure.
  assert.doesNotMatch(error.message, /failed to (load|initialize)/i);
  assert.equal((error as { cause?: unknown }).cause, undefined);
}

/**
 * Asserts an explicit configured transformer that throws while initializing
 * fails with its ORIGINAL diagnostic preserved (message + `cause`), not the
 * generic "Could not load the configured upstream transformer" absence message.
 * Runs through the production `require` loader against a real broken module on
 * disk.
 */
export async function assertConfiguredInitFailurePreservesCause(): Promise<void> {
  const { resolveUpstreamTransformer } = await TestMetroRuntime.loadUpstream();
  const broken = TestMetroRuntime.throwingUpstreamOnDisk();
  const error = captureThrow(() => resolveUpstreamTransformer(broken));
  // The original throw is preserved somewhere in the chain...
  assert.match(messageChain(error), /upstream dependency ABI mismatch/);
  // ...and it is NOT masked as a plain absence.
  assert.doesNotMatch(
    error.message,
    /Could not load the configured upstream transformer/,
  );
  // The cause carries the original stack context.
  const cause = (error as { cause?: unknown }).cause;
  assert.ok(cause instanceof Error, "original error is attached as `cause`");
  assert.match((cause as Error).message, /upstream dependency ABI mismatch/);
  assert.equal(typeof (cause as Error).stack, "string");
}

/**
 * Asserts a configured transformer whose transitive dependency is missing
 * reports THAT dependency failure (its `MODULE_NOT_FOUND`), rather than claiming
 * the candidate itself is absent. This is the differentiator between a
 * resolution failure of the requested specifier and a `MODULE_NOT_FOUND` raised
 * while the (resolvable) module executes.
 */
export async function assertMissingTransitiveDependencyReported(): Promise<void> {
  const { resolveUpstreamTransformer } = await TestMetroRuntime.loadUpstream();
  const broken = TestMetroRuntime.missingDependencyUpstreamOnDisk();
  const error = captureThrow(() => resolveUpstreamTransformer(broken));
  // The missing transitive dependency is named in the diagnostic...
  assert.match(
    messageChain(error),
    /@@ttsc-metro-absent-transitive-dependency@@/,
  );
  // ...and the candidate is not misreported as absent.
  assert.doesNotMatch(
    error.message,
    /Could not load the configured upstream transformer/,
  );
}

/**
 * Asserts auto-detection does NOT fall through to a later candidate when an
 * earlier, resolvable candidate throws during initialization. A broken Expo
 * install must surface, not silently select the legacy React Native transformer.
 */
export async function assertAutoDetectInitFailureDoesNotFallThrough(): Promise<void> {
  const { resolveUpstreamTransformer, UPSTREAM_CANDIDATES } =
    await TestMetroRuntime.loadUpstream();
  const [expo, , legacy] = UPSTREAM_CANDIDATES as readonly string[];
  assert.ok(expo !== undefined && legacy !== undefined);
  const error = captureThrow(() =>
    resolveUpstreamTransformer(undefined, (p: string) => {
      if (p === expo) {
        throw new Error("expo transformer boom");
      }
      return tagged(p);
    }),
  );
  // Surfaces the first candidate's failure with its cause...
  assert.match(messageChain(error), /expo transformer boom/);
  assert.match(error.message, escapeRegExp(expo));
  const cause = (error as { cause?: unknown }).cause;
  assert.ok(cause instanceof Error, "original error is attached as `cause`");
  // ...and it is not the terminal "install one of these" message, i.e. it did
  // not fall through to (and fail past) the legacy candidate.
  assert.doesNotMatch(
    error.message,
    /Could not find an upstream Metro transformer/,
  );
  assert.doesNotMatch(error.message, escapeRegExp(legacy));
}

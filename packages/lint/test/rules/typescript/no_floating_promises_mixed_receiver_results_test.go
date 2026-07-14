package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesCorrelatesMixedReceiverResults verifies Promise
// handler semantics apply only to Promise-like receiver branches while every
// other branch contributes its own method return type.
//
// The matrix covers dot, computed, and optional calls, intersection members,
// generic and uncertain return carriers, overload selection, structural
// thenables, and both safe option families.
//
//  1. Pair safe undefined returns with unsafe Promise returns in mixed calls.
//  2. Repeat the distinction with thenable checks and configured safe values.
//  3. Assert every unsafe twin reports and every handled twin remains clean.
func TestNoFloatingPromisesCorrelatesMixedReceiverResults(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `interface CatchResult<T> {
  catch(onRejected: (reason: unknown) => void): T;
}
interface ThenResult<T> {
  then(onFulfilled: undefined, onRejected: (reason: unknown) => void): T;
}
interface OptionalCatchResult<T> {
  catch?: (onRejected: (reason: unknown) => void) => T;
}
interface MissingCatchResult {
  catch?: undefined;
}
interface FinallyResult<T> {
  finally(onFinally: () => void): T;
}
type TaggedCatchResult<T> = CatchResult<T> & { readonly tag: true };
declare const safeDot: Promise<void> | CatchResult<undefined>;
declare const unsafeDot: Promise<void> | CatchResult<Promise<void>>;
declare const safeComputed: Promise<void> | CatchResult<void>;
declare const unsafeComputed: Promise<void> | CatchResult<Promise<void>>;
declare const safeOptionalReceiver: Promise<void> | CatchResult<undefined> | undefined;
declare const unsafeOptionalReceiver: Promise<void> | CatchResult<Promise<void>> | undefined;
declare const safeOptionalCall: Promise<void> | OptionalCatchResult<undefined>;
declare const unsafeOptionalCall: Promise<void> | OptionalCatchResult<Promise<void>>;
declare const missingOptionalCall: Promise<void> | MissingCatchResult;
declare const safeIntersection: Promise<void> | TaggedCatchResult<undefined>;
declare const unsafeIntersection: Promise<void> | TaggedCatchResult<Promise<void>>;
declare const safeThen: Promise<void> | ThenResult<undefined>;
declare const unsafeThen: Promise<void> | ThenResult<Promise<void>>;
declare const mixedFinally: Promise<void> | FinallyResult<undefined>;
declare const unrelated: CatchResult<Promise<void>>;
safeDot.catch(() => undefined);
unsafeDot.catch(() => undefined);
safeComputed["catch"](() => undefined);
unsafeComputed["catch"](() => undefined);
safeOptionalReceiver?.catch(() => undefined);
unsafeOptionalReceiver?.catch(() => undefined);
safeOptionalCall.catch?.(() => undefined);
unsafeOptionalCall.catch?.(() => undefined);
missingOptionalCall.catch?.(() => undefined);
safeIntersection.catch(() => undefined);
unsafeIntersection.catch(() => undefined);
safeThen.then(undefined, () => undefined);
unsafeThen.then(undefined, () => undefined);
mixedFinally.finally(() => undefined);
unrelated.catch(() => undefined);
interface SafeOverloadedCatchResult {
  catch(onRejected: (reason: unknown) => void): undefined;
  catch(flag: number): Promise<void>;
}
interface UnsafeOverloadedCatchResult {
  catch(onRejected: (reason: unknown) => void): Promise<void>;
  catch(flag: number): undefined;
}
declare const safeOverloaded: Promise<void> | SafeOverloadedCatchResult;
declare const unsafeOverloaded: Promise<void> | UnsafeOverloadedCatchResult;
safeOverloaded.catch(() => undefined);
unsafeOverloaded.catch(() => undefined);
interface SafeFirstCatchResult {
  catch(onRejected: (reason: unknown) => void): undefined;
  catch(onRejected: (reason: unknown) => void): Promise<void>;
}
interface UnsafeFirstCatchResult {
  catch(onRejected: (reason: unknown) => void): Promise<void>;
  catch(onRejected: (reason: unknown) => void): undefined;
}
interface GenericCatchResult {
  catch<TResult = never>(onRejected: (reason: unknown) => TResult): TResult;
}
declare const safeFirst: Promise<void> | SafeFirstCatchResult;
declare const unsafeFirst: Promise<void> | UnsafeFirstCatchResult;
declare const genericResult: Promise<void> | GenericCatchResult;
safeFirst.catch(() => undefined);
unsafeFirst.catch(() => undefined);
genericResult.catch(() => undefined);
genericResult.catch(() => Promise.resolve());
genericResult.catch<undefined>(() => undefined);
genericResult.catch<Promise<void>>(() => Promise.resolve());
interface ReorderedCatchResult {
  catch(onRejected: (reason: unknown) => void): undefined;
}
interface ReorderedCatchResult {
  catch(onRejected: (reason: unknown) => void): Promise<void>;
}
declare const reordered: Promise<void> | ReorderedCatchResult;
reordered.catch(() => undefined);
type ThenKey = "key";
interface SpecializedThenResult {
  then(key: ThenKey, onRejected: () => void): undefined;
  then(key: "key", onRejected: () => void): Promise<void>;
}
declare const specialized: Promise<void> | SpecializedThenResult;
specialized.then("key", () => undefined);
interface AnyCatchResult {
  catch(onRejected: (reason: unknown) => void): any;
}
interface UnknownCatchResult {
  catch(onRejected: (reason: unknown) => void): unknown;
}
declare const anyResult: Promise<void> | AnyCatchResult;
declare const unknownResult: Promise<void> | UnknownCatchResult;
anyResult.catch(() => undefined);
unknownResult.catch(() => undefined);
declare const unrelatedAny: AnyCatchResult;
declare const unrelatedUnknown: UnknownCatchResult;
unrelatedAny.catch(() => undefined);
unrelatedUnknown.catch(() => undefined);
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("mixed receiver run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  expectedLines := []string{
    "main.ts:33:",
    "main.ts:35:",
    "main.ts:37:",
    "main.ts:39:",
    "main.ts:42:",
    "main.ts:44:",
    "main.ts:45:",
    "main.ts:46:",
    "main.ts:58:",
    "main.ts:74:",
    "main.ts:76:",
    "main.ts:78:",
    "main.ts:86:",
    "main.ts:93:",
    "main.ts:102:",
    "main.ts:103:",
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != len(expectedLines) {
    t.Fatalf("expected %d mixed receiver findings, got %d:\n%s", len(expectedLines), got, stderr)
  }
  for _, line := range expectedLines {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing mixed receiver finding at %s\n%s", line, stderr)
    }
  }

  optionSource := `interface CatchResult<T> {
  catch(onRejected: (reason: unknown) => void): T;
}
interface CatchableThenable {
  then(onFulfilled: () => void, onRejected: () => void): CatchableThenable;
  catch(onRejected: (reason: unknown) => void): CatchableThenable;
}
class SafePromise<T> extends Promise<T> {}
declare function allowedCall(): Promise<void>;
declare const safePromiseReturn: Promise<void> | CatchResult<SafePromise<void>>;
declare const unsafePromiseReturn: Promise<void> | CatchResult<Promise<void>>;
declare const handledThenableReceiver: Promise<void> | CatchableThenable;
declare const unsafeThenableReturn: Promise<void> | CatchResult<CatchableThenable>;
safePromiseReturn.catch(() => undefined);
unsafePromiseReturn.catch(() => undefined);
handledThenableReceiver.catch(() => undefined);
unsafeThenableReturn.catch(() => undefined);
allowedCall();
Promise.resolve();
interface IgnoredPromise<T> extends Promise<T> {
  catch<TResult = never>(
    onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): IgnoredPromise<T | TResult>;
}
declare const ignoredPromise: IgnoredPromise<void>;
ignoredPromise.catch();
`
  options := map[string]any{
    "allowForKnownSafeCalls":    []any{"allowedCall"},
    "allowForKnownSafePromises": []any{"SafePromise", "IgnoredPromise"},
    "checkThenables":            true,
  }
  code, stdout, stderr = runNoFloatingPromisesCase(t, optionSource, options)
  if code != 2 || stdout != "" {
    t.Fatalf("mixed receiver option run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  expectedLines = []string{"main.ts:15:", "main.ts:17:", "main.ts:19:"}
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != len(expectedLines) {
    t.Fatalf("expected %d option findings, got %d:\n%s", len(expectedLines), got, stderr)
  }
  for _, line := range expectedLines {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing option finding at %s\n%s", line, stderr)
    }
  }

  options["checkThenables"] = false
  code, stdout, stderr = runNoFloatingPromisesCase(t, optionSource, options)
  if code != 2 || stdout != "" || strings.Count(stderr, "[typescript/no-floating-promises]") != 2 ||
    !diagnosticOutputContains(stderr, "main.ts:15:") ||
    !diagnosticOutputContains(stderr, "main.ts:19:") ||
    diagnosticOutputContains(stderr, "main.ts:17:") {
    t.Fatalf("disabled thenable run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}

package linthost

import (
  "strconv"
  "strings"
  "testing"
)

// TestNoFloatingPromisesCorrelatesMixedReceiverResults verifies Promise
// handler semantics apply only to Promise-like receiver branches while every
// other branch contributes its own method return type.
//
// The matrix covers dot, computed, and optional calls, intersection members,
// generic return carriers, overload selection, structural thenables, and both
// safe option families.
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
`
  options := map[string]any{
    "allowForKnownSafeCalls":    []any{"allowedCall"},
    "allowForKnownSafePromises": []any{"SafePromise"},
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

// TestNoFloatingPromisesRejectsInapplicableGenericReceiverBranches locks the
// conservative proof used for generic non-Promise receiver methods. A return
// type inferred as undefined is not enough: every fixed argument, callback
// parameter, explicit type argument, and callback return must also satisfy the
// candidate declaration before the branch can make the mixed call safe.
func TestNoFloatingPromisesRejectsInapplicableGenericReceiverBranches(t *testing.T) {
  source := `interface FixedGenericThen {
  then<T>(value: number, factory: () => T): T;
}
interface CallbackGenericThen {
  then<T>(value: number, factory: (reason: unknown) => T): T;
}
interface ConstrainedGenericCatch {
  catch<T extends number>(onRejected: () => T): T;
}
interface ExplicitGenericCatch {
  catch<T>(onRejected: () => T): T;
}
interface PartialDefaultGenericThen {
  then<T, U = number>(value: U, factory: () => T): T;
}
interface DependentDefaultGenericThen {
  then<T, U = T>(value: U, factory: () => T): T;
}
interface DependentConstraintGenericThen {
  then<U extends number, T extends U, R>(value: T, factory: () => R): R;
}
interface NonGenericCallbackCatch {
  catch(onRejected: (reason: unknown) => void): undefined;
}
type TaggedFactory<T> = (() => T) & { readonly tag: true };
type OptionalTaggedFactory<T> = (() => T) & { readonly tag?: true };
interface TaggedGenericCatch {
  catch<T>(onRejected: TaggedFactory<T>): T;
}
interface UncertainOverloadedCatch {
  catch(onRejected: () => void): undefined;
  catch<T>(onRejected: (reason: T) => void): Promise<void>;
}
type BivariantCallback<T> = {
  method(reason: unknown): T;
}["method"];
interface BivariantOverloadedCatch {
  catch<T>(onRejected: BivariantCallback<T>): Promise<void>;
  catch(onRejected: (reason: string) => void): undefined;
}
interface VoidArityOverloadedCatch {
  catch(handler: void): Promise<void>;
  catch(): undefined;
}
interface PredicateGenericCatch {
  catch<T>(onRejected: (value: unknown) => value is T): T;
}
interface AssertionGenericCatch {
  catch<T>(onRejected: (value: unknown) => asserts value is T): T;
}
interface TupleRestCatch {
  catch(...args: [(reason: unknown) => void]): undefined;
}
interface FunctionCatch {
  catch(onRejected: Function): undefined;
}
class PrivateTag {
  private tag!: true;
}
type PrivateFactory<T> = (() => T) & PrivateTag;
interface PrivateGenericCatch {
  catch<T>(onRejected: PrivateFactory<T>): T;
}
declare const fixedValid: Promise<void> | FixedGenericThen;
declare const fixedMismatch: Promise<void> | FixedGenericThen;
declare const callbackValid: Promise<void> | CallbackGenericThen;
declare const callbackMismatch: Promise<void> | CallbackGenericThen;
declare const constrainedValid: Promise<void> | ConstrainedGenericCatch;
declare const constrainedMismatch: Promise<void> | ConstrainedGenericCatch;
declare const explicitValid: Promise<void> | ExplicitGenericCatch;
declare const explicitMismatch: Promise<void> | ExplicitGenericCatch;
declare const partialDefaultValid: Promise<void> | PartialDefaultGenericThen;
declare const partialDefaultMismatch: Promise<void> | PartialDefaultGenericThen;
declare const dependentDefaultValid: Promise<void> | DependentDefaultGenericThen;
declare const dependentDefaultMismatch: Promise<void> | DependentDefaultGenericThen;
declare const dependentConstraintMismatch: Promise<void> | DependentConstraintGenericThen;
declare const nonGenericCallbackValid: Promise<void> | NonGenericCallbackCatch;
declare const nonGenericCallbackMismatch: Promise<void> | NonGenericCallbackCatch;
declare const taggedValid: Promise<void> | TaggedGenericCatch;
declare const taggedMismatch: Promise<void> | TaggedGenericCatch;
declare const taggedFactory: TaggedFactory<undefined>;
declare const optionalTaggedFactory: OptionalTaggedFactory<undefined>;
declare const uncertainOverload: Promise<void> | UncertainOverloadedCatch;
declare const bivariantOverload: Promise<void> | BivariantOverloadedCatch;
declare const voidArityOverload: Promise<void> | VoidArityOverloadedCatch;
declare const predicateMismatch: Promise<void> | PredicateGenericCatch;
declare const predicateTargetMismatch: Promise<void> | PredicateGenericCatch;
declare const assertionMismatch: Promise<void> | AssertionGenericCatch;
declare const tupleRestOverflow: Promise<void> | TupleRestCatch;
declare const functionContractSafe: Promise<void> | FunctionCatch;
declare const privateMismatch: Promise<void> | PrivateGenericCatch;
declare const privateSourceMismatch: Promise<void> | TaggedGenericCatch;
declare const publicTaggedFactory: (() => undefined) & { tag: true };
declare const privateTaggedFactory: PrivateFactory<undefined>;
fixedValid.then(1, () => undefined);
fixedMismatch.then("not a number", () => undefined);
callbackValid.then(1, (reason: unknown) => undefined);
callbackMismatch.then(1, (reason: string) => undefined);
constrainedValid.catch<number>(() => 1);
constrainedMismatch.catch<string>(() => "not a number");
explicitValid.catch<undefined>(() => undefined);
explicitMismatch.catch<undefined>(() => Promise.resolve());
partialDefaultValid.then<undefined>(1, () => undefined);
partialDefaultMismatch.then<undefined>("not a number", () => undefined);
dependentDefaultValid.then<undefined>(undefined, () => undefined);
dependentDefaultMismatch.then<undefined>(Promise.resolve(), () => undefined);
dependentConstraintMismatch.then<1, 2, undefined>(2, () => undefined);
nonGenericCallbackValid.catch((reason: unknown) => undefined);
nonGenericCallbackMismatch.catch((reason: string) => undefined);
taggedValid.catch(taggedFactory);
taggedMismatch.catch(() => undefined);
taggedMismatch.catch(optionalTaggedFactory);
uncertainOverload.catch(() => undefined);
bivariantOverload.catch((reason: string) => undefined);
voidArityOverload.catch();
predicateMismatch.catch<undefined>((value: unknown): boolean => true);
predicateTargetMismatch.catch<undefined>((value: unknown): value is string => true);
assertionMismatch.catch<undefined>((value: unknown): void => {});
tupleRestOverflow.catch(() => undefined, () => undefined);
functionContractSafe.catch(() => undefined);
privateMismatch.catch(publicTaggedFactory);
privateSourceMismatch.catch(privateTaggedFactory);
function checkUncertain<U>(
  uncertainResult: Promise<void> | ExplicitGenericCatch,
  factory: () => U,
): void {
  uncertainResult.catch(factory);
}
function checkUncertainArray<U>(
  uncertainArrayResult: Promise<void> | ExplicitGenericCatch,
  factory: () => [U],
): void {
  uncertainArrayResult.catch(factory);
}
`
  code, stdout, stderr := runNoFloatingPromisesCase(t, source, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("generic applicability run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  unsafeMarkers := []string{
    "fixedMismatch.then",
    "callbackMismatch.then",
    "constrainedMismatch.catch",
    "explicitMismatch.catch",
    "partialDefaultMismatch.then",
    "dependentDefaultMismatch.then",
    "dependentConstraintMismatch.then",
    "nonGenericCallbackMismatch.catch",
    "taggedMismatch.catch",
    "taggedMismatch.catch(optionalTaggedFactory)",
    "uncertainOverload.catch",
    "bivariantOverload.catch",
    "voidArityOverload.catch",
    "predicateMismatch.catch",
    "predicateTargetMismatch.catch",
    "assertionMismatch.catch",
    "tupleRestOverflow.catch",
    "privateMismatch.catch",
    "privateSourceMismatch.catch",
    "uncertainResult.catch",
    "uncertainArrayResult.catch",
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != len(unsafeMarkers) {
    t.Fatalf("expected %d generic applicability findings, got %d:\n%s", len(unsafeMarkers), got, stderr)
  }
  for _, marker := range unsafeMarkers {
    offset := strings.Index(source, marker)
    if offset < 0 {
      t.Fatalf("missing source marker %q", marker)
    }
    location := "main.ts:" + strconv.Itoa(strings.Count(source[:offset], "\n")+1) + ":"
    if !diagnosticOutputContains(stderr, location) {
      t.Fatalf("missing generic applicability finding at %s (%s)\n%s", location, marker, stderr)
    }
  }
}

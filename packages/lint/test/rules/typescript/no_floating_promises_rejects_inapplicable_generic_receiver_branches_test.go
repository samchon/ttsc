package linthost

import (
  "strconv"
  "strings"
  "testing"
)

// TestNoFloatingPromisesRejectsInapplicableGenericReceiverBranches locks the
// conservative proof used for generic non-Promise receiver methods. A return
// type inferred as undefined is not enough: every fixed argument, callback
// parameter, explicit type argument, and callback return must also satisfy the
// candidate declaration before the branch can make the mixed call safe.
//
//  1. Pair valid generic receiver branches with one-contract-away invalid twins.
//  2. Exercise constraints, defaults, callback variance, properties, and unsupported shapes.
//  3. Assert every unsafe or uncertain call reports while every proven-safe twin remains clean.
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
    "explicitMismatch.catch",
    "partialDefaultMismatch.then",
    "dependentDefaultMismatch.then",
    "nonGenericCallbackMismatch.catch",
    "taggedMismatch.catch",
    "taggedMismatch.catch(optionalTaggedFactory)",
    "uncertainOverload.catch",
    "bivariantOverload.catch",
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
  compilerRejectedMarkers := []string{
    "fixedMismatch.then",
    "callbackMismatch.then",
    "constrainedMismatch.catch",
    "dependentConstraintMismatch.then",
  }
  for _, marker := range compilerRejectedMarkers {
    offset := strings.Index(source, marker)
    if offset < 0 {
      t.Fatalf("missing compiler-rejected source marker %q", marker)
    }
    location := "main.ts:" + strconv.Itoa(strings.Count(source[:offset], "\n")+1) + ":"
    if !diagnosticOutputContains(stderr, location) {
      t.Fatalf("missing compiler rejection at %s (%s)\n%s", location, marker, stderr)
    }
  }
}

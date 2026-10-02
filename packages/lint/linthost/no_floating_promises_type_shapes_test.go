package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesTypeAndExpressionShapes locks the checker-backed
// Promise identity and recursive expression paths required by issue #412.
//
//  1. Build Promise aliases, subclasses, unions, intersections, composites,
//     assertions, arrays, and explicit Promise/non-Promise tuples.
//  2. Run the rule with scalar defaults.
//  3. Assert every Promise-bearing shape and no clean control is reported.
//
// @evidence contracts/testing.md#behavioral-verification Promise detection must preserve the supported composite and asserted expression shapes.
// @evidence contracts/testing.md#independent-expectations Independently authored source and original assertions require exact error lines 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 27, 29, 33, 34, 35, 36, 39, 40, 43, code 2 and empty stdout for reporting command runs; all original inputs/options and clean arms are retained.
// @evidence contracts/testing.md#distinguishing-cases Aliases, subclasses, intersections/unions, optional calls, composites, tuples/arrays, assertions/non-null/satisfies and uncertain branches have authored positive/clean counterparts; unknown/any uncertainty is not a runtime completion guarantee.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesTypeAndExpressionShapes invokes the in-process check command over a real Program/Checker through the owning floating-promise fixture helpers in one Go unit process, without a native build, installed consumer or compiler child.
func TestNoFloatingPromisesTypeAndExpressionShapes(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `type PromiseAlias<T> = Promise<T>;
class DerivedPromise<T> extends Promise<T> {}
declare const aliasPromise: PromiseAlias<void>;
declare const derivedPromise: DerivedPromise<void>;
declare const intersectedPromise: Promise<void> & { readonly tag: true };
declare const unionPromise: Promise<void> | undefined;
declare const optionalFactory: (() => Promise<void>) | undefined;
declare const flag: boolean;
declare const unknownValue: unknown;
declare const promiseTuple: readonly [Promise<void>, number];
declare const valueTuple: readonly [number, string];
aliasPromise;
derivedPromise;
intersectedPromise;
unionPromise;
optionalFactory?.();
flag ? Promise.resolve() : undefined;
flag && Promise.resolve();
(Promise.resolve(), undefined);
promiseTuple;
[Promise.resolve(), 1];
valueTuple;
[1, 2, 3];
void Promise.resolve();
unknownValue as Promise<void>;
aliasPromise as unknown;
aliasPromise!;
unknownValue!;
aliasPromise satisfies Promise<void>;
0 satisfies number;
declare const anyValue: any;
declare const maybePromise: Promise<void> | undefined;
flag ? Promise.resolve() : anyValue;
flag ? Promise.resolve() : unknownValue;
maybePromise && anyValue;
unknownValue || Promise.resolve();
flag ? undefined : anyValue;
unknownValue || 0;
[Promise.resolve(), anyValue];
[Promise.resolve(), unknownValue];
[undefined, anyValue];
[undefined, unknownValue];
[...[Promise.resolve(), anyValue], anyValue];
[...[undefined, anyValue], anyValue];
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("type-shape run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  expectedLines := []string{
    "main.ts:12:",
    "main.ts:13:",
    "main.ts:14:",
    "main.ts:15:",
    "main.ts:16:",
    "main.ts:17:",
    "main.ts:18:",
    "main.ts:19:",
    "main.ts:20:",
    "main.ts:21:",
    "main.ts:25:",
    "main.ts:27:",
    "main.ts:29:",
    "main.ts:33:",
    "main.ts:34:",
    "main.ts:35:",
    "main.ts:36:",
    "main.ts:39:",
    "main.ts:40:",
    "main.ts:43:",
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != len(expectedLines) {
    t.Fatalf("expected %d shape findings, got %d:\n%s", len(expectedLines), got, stderr)
  }
  for _, line := range expectedLines {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing shape finding at %s\n%s", line, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 27, 29, 33, 34, 35, 36, 39, 40, 43)
}

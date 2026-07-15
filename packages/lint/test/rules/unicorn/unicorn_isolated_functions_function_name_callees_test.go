package linthost

import "testing"

// TestUnicornIsolatedFunctionsFunctionNameCallees verifies the `functions`
// option: every function form passed at any argument position of a configured
// bare-name callee is isolated, and the option replaces (not extends) the
// defaults.
//
// Upstream matches `node.parent.arguments.includes(node)` with an Identifier
// callee, so member callees and unlisted names must stay silent, parentheses
// are transparent, and a named function expression's own name — resolved in
// the function-expression-name scope above the function scope — is reported
// when used recursively.
//
//  1. Pass arrows, async arrows, function expressions, and a parenthesized
//     arrow to makeSynchronous/workerize and assert each capture is reported.
//  2. Assert unlisted callees, member callees, and object arguments are clean.
//  3. Re-run with functions ["myIsolate"] and assert the defaults stop
//     matching while the custom name reports.
func TestUnicornIsolatedFunctionsFunctionNameCallees(t *testing.T) {
  source := `declare function makeSynchronous(...args: unknown[]): unknown;
declare function workerize(...args: unknown[]): unknown;
declare function memoize(...args: unknown[]): unknown;
declare const ns: { makeSynchronous(...args: unknown[]): unknown };

const captured = "hi";

makeSynchronous(() => captured.slice());
workerize(async () => captured.slice());
makeSynchronous(async function (): Promise<string> {
  return captured.slice();
});
makeSynchronous(function named(): string {
  return named.name;
});
makeSynchronous(1, () => captured.slice());
makeSynchronous((((() => captured.slice()))));
memoize(() => captured.slice());
ns.makeSynchronous(() => captured.slice());
makeSynchronous({ method() { return captured.slice(); } });
`
  reason := `callee of function named "makeSynchronous"`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, ""),
    unicornIsolatedFunctionsFinding{
      line:    8,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    9,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", `callee of function named "workerize"`),
    },
    unicornIsolatedFunctionsFinding{
      line:    11,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    14,
      target:  "named",
      message: unicornIsolatedFunctionsVariableMessage("named", reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    16,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    17,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", reason),
    },
  )

  replaced := `declare function makeSynchronous(...args: unknown[]): unknown;
declare function myIsolate(...args: unknown[]): unknown;

const captured = "hi";

makeSynchronous(() => captured.slice());
myIsolate(() => captured.slice());
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, replaced, `{"functions": ["myIsolate"]}`),
    unicornIsolatedFunctionsFinding{
      line:    7,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", `callee of function named "myIsolate"`),
    },
  )
}

package linthost

import "testing"

// TestRuleCorpusUnicornIsolatedFunctions verifies the real-command corpus
// fixture's scope-escape semantics through the checker-backed native engine.
//
// The corpus is the end-to-end command oracle; this package-local twin keeps
// its exact positive and negative cases visible in focused Go coverage,
// including the recursion-through-hoisted-name report the upstream scope
// model mandates.
//
//  1. Run the annotated fixture source with a real Program and checker.
//  2. Assert the captured references, the hoisted-name recursion, and the
//     `this` usage are reported with their isolation reasons.
//  3. Assert the clean twin using parameters, locals, and ambient globals
//     stays silent.
func TestRuleCorpusUnicornIsolatedFunctions(t *testing.T) {
  source := `declare function makeSynchronous<T>(fn: T): T;

const captured = "hi";

// expect: unicorn/isolated-functions error
makeSynchronous(() => captured.slice());

/** @isolated */
function viaComment(): string {
  // expect: unicorn/isolated-functions error
  // expect: unicorn/isolated-functions error
  return captured.slice() + viaComment.name;
}
viaComment();

makeSynchronous(function (this: { key: string }) {
  // expect: unicorn/isolated-functions error
  return this.key;
});

// Clean twin: parameters, locals, and ambient globals stay usable inside the
// isolated function.
makeSynchronous((prefix: string) => {
  const local = "ok";
  console.log(local);
  return prefix + local + new Array(1).length;
});
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, ""),
    unicornIsolatedFunctionsFinding{
      line:    6,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", `callee of function named "makeSynchronous"`),
    },
    unicornIsolatedFunctionsFinding{
      line:    12,
      target:  "captured",
      message: unicornIsolatedFunctionsVariableMessage("captured", `follows comment "@isolated"`),
    },
    unicornIsolatedFunctionsFinding{
      line:    12,
      target:  "viaComment",
      message: unicornIsolatedFunctionsVariableMessage("viaComment", `follows comment "@isolated"`),
    },
    unicornIsolatedFunctionsFinding{
      line:    18,
      target:  "this",
      message: unicornIsolatedFunctionsThisMessage(`callee of function named "makeSynchronous"`),
    },
  )
}

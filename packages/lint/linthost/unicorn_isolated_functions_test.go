package linthost

import "testing"

// TestRuleCorpusUnicornIsolatedFunctions verifies the corpus fixture's
// authored scope-capture cases through the checker-backed Go engine.
//
// This package-local twin retains the corpus's positive and negative source
// cases, including the reported recursive hoisted name. Its independent
// literal tuples fix each line, target and isolation reason.
//
//  1. Run the annotated fixture source with a real Program and checker.
//  2. Assert the captured references, the hoisted-name recursion, and the
//     `this` usage are reported with their isolation reasons.
//  3. Assert the clean twin using parameters, locals, and ambient globals
//     stays silent.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify four exact outer-capture/hoisted-recursion/this findings report while the parameter/local/global callback stays clean; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations Authored exact line/target/reason tuples independently specify the supported scope-escape behavior. Test-owned message interpolation composes the authored sentence and does not call the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases Bare makeSynchronous capture, comment-marked value and own recursive name, and direct this report; callback parameter/local/console/Array remain usable.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornIsolatedFunctions is a discoverable Go unit host; its literal source cases under default options run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
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

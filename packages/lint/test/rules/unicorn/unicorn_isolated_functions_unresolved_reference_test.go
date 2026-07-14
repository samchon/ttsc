package linthost

import "testing"

// TestUnicornIsolatedFunctionsUnresolvedReference verifies that a name which
// resolves to no declaration at all — an inherited prototype property name
// like `constructor` or any undeclared identifier — is reported, while a real
// ambient global on the same line is not.
//
// Upstream's scope.through carries unresolved references, and
// getAllowedGlobalValue only whitelists names that are configured globals; an
// unresolved identifier is neither declared inside the function nor an ambient
// global, so it escapes.
//
// 1. Assert `constructor` and an undeclared `missingGlobal` are reported.
// 2. Assert the ambient global `Array` on the same callback stays clean.
func TestUnicornIsolatedFunctionsUnresolvedReference(t *testing.T) {
  reason := `callee of function named "makeSynchronous"`
  source := `declare function makeSynchronous<T>(fn: T): T;

makeSynchronous(() => [constructor, missingGlobal, new Array()]);
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, ""),
    unicornIsolatedFunctionsFinding{
      line:    3,
      target:  "constructor",
      message: unicornIsolatedFunctionsVariableMessage("constructor", reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    3,
      target:  "missingGlobal",
      message: unicornIsolatedFunctionsVariableMessage("missingGlobal", reason),
    },
  )
}

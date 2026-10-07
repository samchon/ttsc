package linthost

import "testing"

// TestUnicornIsolatedFunctionsUnresolvedReference verifies that a name which
// resolves to no declaration at all — an inherited prototype property name
// like `constructor` or any undeclared identifier — is reported, while a real
// ambient global on the same line is not.
//
// The native checker-backed reference check reports identifiers without a
// resolved value symbol when no allowed-global policy admits them. Array is
// resolved as an ambient global and is allowed by the default policy.
//
// 1. Assert `constructor` and an undeclared `missingGlobal` are reported.
// 2. Assert the ambient global `Array` on the same callback stays clean.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify constructor and undeclared missingGlobal report while ambient Array stays clean; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations The authored exact target/line/reason records independently distinguish unresolved references from recognized ambient globals. Test-owned message interpolation composes the authored literal sentence and does not call the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases Prototype-like constructor and ordinary undeclared identifier are unresolved; the same callback uses allowed Array without a third finding.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsUnresolvedReference is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
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

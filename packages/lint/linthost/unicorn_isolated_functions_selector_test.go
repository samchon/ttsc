package linthost

import "testing"

// TestUnicornIsolatedFunctionsSelector verifies the `selectors` option: a
// function matching a configured AST selector becomes isolated and reports its
// captures with a `matches selector ...` reason, while a non-matching sibling
// stays clean.
//
// Upstream registers one onExit listener per selector; the port pre-matches
// the selector against the tree and attaches the reason in option order. The
// reason string is the JSON-quoted selector source, combinators included.
//
//  1. Isolate `FunctionDeclaration[id.name=/lambdaHandler.*/]` and assert the
//     matching declaration's captured `foo` is reported.
//  2. Assert the non-matching declaration's identical capture stays clean.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify only the lambdaHandler declaration selected by its authored AST selector reports its capture; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations The literal selector and exact line/target/quoted-reason record specify supported selector matching independently of the selector implementation. Test-owned message interpolation composes the authored upstream sentence and does not call the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases Identical foo reads in matching and nonmatching declaration names change isolation eligibility, keeping the nonmatching sibling clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsSelector is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
func TestUnicornIsolatedFunctionsSelector(t *testing.T) {
  source := `const foo = "hi";

function lambdaHandlerFoo() {
  return foo.slice();
}

function someOtherFunction() {
  return foo.slice();
}
`
  selector := "FunctionDeclaration[id.name=/lambdaHandler.*/]"
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, `{"selectors": ["`+selector+`"]}`),
    unicornIsolatedFunctionsFinding{
      line:    4,
      target:  "foo",
      message: unicornIsolatedFunctionsVariableMessage("foo", `matches selector "`+selector+`"`),
    },
  )
}

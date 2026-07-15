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

package linthost

import "testing"

// TestUnicornIsolatedFunctionsParameterDefaultCapture verifies that an outer
// binding referenced from a parameter default value is a scope escape, whether
// the default is on a plain parameter or a destructuring binding element.
//
// Parameter defaults are evaluated in the function's own scope, so upstream's
// scope.through carries the outer reference; the port walks the parameter list
// as an analysis root and reports the captured initializer while the parameter
// names themselves stay declared-in-scope.
//
// 1. Capture outer `outer` from a plain parameter default and from a
//    destructuring element default under makeSynchronous.
// 2. Assert each reference is reported once, and the parameter names are not.
func TestUnicornIsolatedFunctionsParameterDefaultCapture(t *testing.T) {
  reason := `callee of function named "makeSynchronous"`
  source := `declare function makeSynchronous<T>(fn: T): T;

const outer = "hi";

makeSynchronous((x = outer) => x);

makeSynchronous(({ a = outer }: { a?: string }) => a);
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, ""),
    unicornIsolatedFunctionsFinding{
      line:    5,
      target:  "outer",
      message: unicornIsolatedFunctionsVariableMessage("outer", reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    7,
      target:  "outer",
      message: unicornIsolatedFunctionsVariableMessage("outer", reason),
    },
  )
}

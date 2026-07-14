package linthost

import "testing"

// TestUnicornIsolatedFunctionsScopeInternals verifies that bindings introduced
// anywhere inside an isolated function — nested closures over its locals,
// nested function declarations, method parameters and locals, destructuring
// parameters, and a local that shadows an outer binding — never count as scope
// escapes.
//
// These are the negative twins for the capture reports: upstream's
// scope.through only carries references that fail to resolve within the
// isolated scope, so a resolved inner binding (including a shadow of an outer
// name) must stay silent. An over-match here would fire on ordinary code.
//
// 1. Exercise nested closure/function, object-method params+locals+global,
//    destructuring params, and a shadowing local.
// 2. Assert nothing is reported.
func TestUnicornIsolatedFunctionsScopeInternals(t *testing.T) {
  source := `declare function makeSynchronous<T>(fn: T): T;

const shadowed = "outer";

/** @isolated */
function withNestedClosure() {
  const local = "hi";
  const slice = () => local.slice();
  function helper() {
    return slice();
  }
  return helper();
}
withNestedClosure();

const object = {
  /** @isolated */
  method(param: string) {
    const bar = param.slice();
    return console.log(bar);
  },
};
object.method("x");

makeSynchronous(({ a, b }: { a: string; b: string }) => a + b);

makeSynchronous(() => {
  const shadowed = "inner";
  return shadowed.slice();
});
`
  assertUnicornIsolatedFunctionsFindings(t, runUnicornIsolatedFunctions(t, source, ""))
}

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
//  1. Exercise nested closure/function, object-method params+locals+global,
//     destructuring params, and a shadowing local.
//  2. Assert nothing is reported.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify nested closures, local function/method bindings, destructured parameters and shadowing locals remain clean; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations The authored empty oracle expresses upstream scope-through resolution for bindings introduced within the isolated boundary. No diagnostic message interpolation is used by this zero-finding host.
// @evidence contracts/testing.md#distinguishing-cases Nested helper reads, method parameters/locals/ambient console, destructured a/b and shadowed local references do not escape; TestRuleCorpusUnicornIsolatedFunctions owns outer-binding positives.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsScopeInternals is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
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

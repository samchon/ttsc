package linthost

import "testing"

// TestNoExtendNativeCoversEveryNativeConstructorWithAPrototype verifies that
// no-extend-native protects the typed-array, error-subclass and other native
// constructors, not only the original fifteen.
//
// ESLint takes the protected set from every capitalized builtin global, so
// extending `Uint8Array.prototype` or `TypeError.prototype` is as much a shared
// realm mutation as extending `Array.prototype`. A name outside the builtin set
// and a builtin named in `exceptions` stay silent.
//
//  1. Run the rule over a prototype assignment for several typed arrays, error
//     subclasses, BigInt and DataView and assert each reports once.
//  2. Run it over `Foo.prototype.x = 1` and assert nothing is reported.
//  3. Run it over `Uint8Array.prototype.x = 1` with `exceptions: ["Uint8Array"]`
//     and assert nothing is reported.
//
// @evidence contracts/testing.md#behavioral-verification no-extend-native must report prototype writes for every native constructor with a prototype and must keep a non-native name and an excepted builtin silent.
// @evidence contracts/testing.md#independent-expectations ESLint derives the protected set from the capitalized builtin globals, so the authored builtin names are the oracle for reports and the user-defined and excepted names for silence.
// @evidence contracts/testing.md#distinguishing-cases The reported and silent sources differ only in the constructor name or in the exceptions option, so a rule using a short fixed list or ignoring the option fails one side.
// @evidence contracts/testing.md#execution-ownership TestNoExtendNativeCoversEveryNativeConstructorWithAPrototype parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoExtendNativeCoversEveryNativeConstructorWithAPrototype(t *testing.T) {
  for _, name := range []string{
    "Uint8Array", "Float64Array", "BigInt64Array", "ArrayBuffer", "DataView",
    "TypeError", "RangeError", "AggregateError", "BigInt", "WeakRef",
  } {
    source := name + ".prototype.extra = 1;\n"
    _, _, findings := runRuleFindingsSnapshot(t, "no-extend-native", source, nil)
    if len(findings) != 1 {
      t.Fatalf("no-extend-native on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
  assertRuleSkipsSource(t, "no-extend-native", "Foo.prototype.extra = 1;\n")
  assertRuleSkipsSourceWithOptions(t, "no-extend-native", "Uint8Array.prototype.extra = 1;\n", `{"exceptions":["Uint8Array"]}`)
}

package linthost

import "testing"

// TestNoExtendNativeCoversEveryNativeConstructorWithAPrototype verifies that
// no-extend-native protects the typed-array, error-subclass and other native
// constructors in the ECMAScript 2026 builtin set.
//
// ESLint takes the protected set from every capitalized builtin global, so
// extending `Uint8Array.prototype` or `TypeError.prototype` is as much a shared
// realm mutation as extending `Array.prototype`. A name outside the builtin set
// and a builtin named in `exceptions` stay silent.
//
//  1. Run a prototype assignment for each authored native constructor with a
//     prototype and assert each reports once.
//  2. Run it over `Foo.prototype.x = 1` and assert nothing is reported.
//  3. Run it over `Uint8Array.prototype.x = 1` with `exceptions: ["Uint8Array"]`
//     and assert nothing is reported.
//
// @evidence contracts/testing.md#behavioral-verification no-extend-native must report prototype writes for every native constructor with a prototype and must keep a non-native name and an excepted builtin silent.
// @evidence contracts/testing.md#independent-expectations ESLint derives the protected set from the capitalized builtin globals, so the authored builtin names are the oracle for reports and the user-defined and excepted names for silence.
// @evidence contracts/testing.md#distinguishing-cases The reported and silent sources differ only in the constructor name or in the exceptions option, so a rule using a short fixed list or ignoring the option fails one side.
// @evidence contracts/testing.md#execution-ownership The selected Go Test passes each literal constructor source to runRuleFindingsSnapshot, whose direct Program/checker lifecycle resolves native bindings before the actual engine executes; no consumer installation or native product-host build runs.
func TestNoExtendNativeCoversEveryNativeConstructorWithAPrototype(t *testing.T) {
  for _, name := range []string{
    "AggregateError", "Array", "ArrayBuffer", "BigInt", "BigInt64Array",
    "BigUint64Array", "Boolean", "DataView", "Date", "Error", "EvalError",
    "FinalizationRegistry", "Float16Array", "Float32Array", "Float64Array",
    "Function", "Int16Array", "Int32Array", "Int8Array", "Iterator", "Map",
    "Number", "Object", "Promise", "RangeError", "ReferenceError", "RegExp",
    "Set", "SharedArrayBuffer", "String", "Symbol", "SyntaxError", "TypeError",
    "Uint16Array", "Uint32Array", "Uint8Array", "Uint8ClampedArray", "URIError",
    "WeakMap", "WeakRef", "WeakSet",
  } {
    t.Run(name, func(t *testing.T) {
      source := name + ".prototype.extra = 1;\n"
      _, _, findings := runRuleFindingsSnapshot(t, "no-extend-native", source, nil)
      if len(findings) != 1 {
        t.Errorf("no-extend-native on %q: want exactly one finding, got %d", source, len(findings))
      }
    })
  }
  assertRuleSkipsSource(t, "no-extend-native", "Foo.prototype.extra = 1;\n")
  assertRuleSkipsSourceWithOptions(t, "no-extend-native", "Uint8Array.prototype.extra = 1;\n", `{"exceptions":["Uint8Array"]}`)
}

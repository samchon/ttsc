package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsFunctionShadow verifies the shadow
// bailout also covers a file-scope `function String() {}` declaration.
//
// A function declaration creates a value binding, not a type declaration.
// The AST-local guard nevertheless declines whenever a same-named function
// exists at file scope. This pins that conservative policy, without claiming
// the function owns the annotation's type or that a checker resolved it.
//
//  1. Parse a file that declares `function String()` and annotates with it.
//  2. Run the rule under the engine and confirm zero findings.
//  3. The shadowed `String` annotation survives byte-for-byte.
//
// @evidence contracts/testing.md#behavioral-verification The wrapper-type rule emits no finding beside a file-scope function value binding named String.
// @evidence contracts/testing.md#independent-expectations The authored declaration and zero findings specify the supported conservative file-binding policy, not a claim that the annotation resolves to a function-created type.
// @evidence contracts/testing.md#distinguishing-cases The same-named function triggers the file-wide bailout, unlike the unshadowed String positive arm; no successful compilation or symbol-resolution result is certified.
// @evidence contracts/testing.md#execution-ownership TestFixNoWrapperObjectTypesSkipsFunctionShadow calls assertRuleSkipsSource on the function-String fixture.
func TestFixNoWrapperObjectTypesSkipsFunctionShadow(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-wrapper-object-types",
    "function String() {}\nconst x: String = new (String as any)();\nJSON.stringify(x);\n",
  )
}

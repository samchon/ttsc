package linthost

import "testing"

// TestRuleCorpusUnicornNoStaticOnlyClass verifies unicorn/no-static-only-class
// reports a class whose only member is a static method.
//
// The rule fires when a class has at least one member and every member is a
// method, property, getter, or setter declaration with the `static` modifier.
// Empty classes are out of scope because a separate rule handles them. This
// fixture pins the single-static-method shape so the modifier-and-kind walk
// stays covered.
//
// 1. Enable unicorn/no-static-only-class via an expect annotation.
// 2. Declare a class with only a static helper method.
// 3. Assert the class declaration is reported.
func TestRuleCorpusUnicornNoStaticOnlyClass(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-static-only-class.ts", "// expect: unicorn/no-static-only-class error\nclass Utility {\n  static helper() { return 42; }\n}\nvoid Utility;\n")
}

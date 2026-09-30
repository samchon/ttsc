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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a class contains only static methods; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-static-only-class annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a class includes an instance method. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoStaticOnlyClass is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoStaticOnlyClass(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-static-only-class.ts", "// expect: unicorn/no-static-only-class error\nclass Utility {\n  static helper() { return 42; }\n}\nvoid Utility;\n")
  assertRuleSkipsSource(t, "unicorn/no-static-only-class", "class Utility { helper() { return 42; } }\n")
}

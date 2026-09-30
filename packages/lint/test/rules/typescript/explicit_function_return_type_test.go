package linthost

import "testing"

// TestRuleCorpusExplicitFunctionReturnType verifies the lint rule corpus
// fixture typescript-explicit-function-return-type.ts.
//
// The rule fires on FunctionDeclaration and MethodDeclaration that have
// a body but no return-type annotation. Arrow functions, function
// expressions, and overload signatures without bodies are skipped.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Body-bearing named functions and methods without return annotations must report.
// @evidence contracts/testing.md#independent-expectations Two authored markers fix complete rule/error/line triples for noReturnType and Foo.bare.
// @evidence contracts/testing.md#distinguishing-cases Annotated functions/methods, arrows, function expressions and bodyless overloads stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusExplicitFunctionReturnType executes the AST Engine through assertRuleCorpusCase in the shared Go unit population; every original source/marker is preserved and no native artifact build, installation or child compiler runs.
func TestRuleCorpusExplicitFunctionReturnType(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-explicit-function-return-type.ts", "// expect: typescript/explicit-function-return-type error\nfunction noReturnType(x: number) {\n  return x + 1;\n}\n\nfunction withReturnType(x: number): number {\n  return x + 1;\n}\n\nclass Foo {\n  // expect: typescript/explicit-function-return-type error\n  bare(x: number) {\n    return x + 1;\n  }\n\n  annotated(x: number): number {\n    return x + 1;\n  }\n}\n\n// Arrow function — intentionally not flagged by the AST-only baseline.\nconst arrow = (x: number) => x + 1;\n\n// Function expression — also skipped.\nconst fn = function (x: number) {\n  return x + 1;\n};\n\n// Overload signatures (no body) are skipped; only the implementation\n// with a body would be flagged, and this one carries a return type.\nfunction over(x: number): number;\nfunction over(x: string): string;\nfunction over(x: number | string): number | string {\n  return x;\n}\n\nJSON.stringify({ noReturnType, withReturnType, Foo, arrow, fn, over });\n")
}

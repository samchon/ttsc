package linthost

import "testing"

// TestRuleCorpusNoInvalidThis verifies the lint rule corpus fixture no-invalid-this.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-invalid-this.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoInvalidThis(t *testing.T) {
	assertRuleCorpusCase(t, "no-invalid-this.ts", "// Positive: top-level `this` has no binding in a module — it resolves to\n// `undefined`, so reading from it is almost always a copy-paste from a\n// class method.\n// expect: no-invalid-this error\nvoid this;\n\n// Positive: arrow functions inherit `this` from the enclosing scope, so a\n// top-level arrow has no `this` binding either.\nconst topArrow = (): void => {\n  // expect: no-invalid-this error\n  void this;\n};\nvoid topArrow;\n\n// Negative: a regular function declaration creates its own `this`.\nfunction regular(this: { value: number }): number {\n  return this.value;\n}\nvoid regular;\n\n// Negative: methods and class static blocks each provide a `this`\n// binding even when nested arrow functions read it.\nclass Owner {\n  public value: number = 1;\n  public read(): number {\n    const inner = (): number => this.value;\n    return inner();\n  }\n  public static counter: number = 0;\n  static {\n    const bump = (): void => {\n      this.counter += 1;\n    };\n    bump();\n  }\n}\nvoid new Owner().read();\n")
}

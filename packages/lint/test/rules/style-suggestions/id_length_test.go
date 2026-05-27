package linthost

import "testing"

// TestRuleCorpusIdLength verifies the lint rule corpus fixture
// id-length.ts.
//
// The rule reports declaration names shorter than the default minimum
// of two characters. Single-letter variable, function, class, and
// parameter names are the canonical failure; two-character bindings
// remain accepted as the inclusive lower bound.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusIdLength(t *testing.T) {
	assertRuleCorpusCase(t, "id-length.ts", "// expect: id-length error\nconst a: number = 1;\nconst ab: number = 2;\nconst longer: number = 3;\n// expect: id-length error\nfunction f(): void {}\nfunction go(): void {}\n// expect: id-length error\nclass C {}\nclass Foo {}\nfunction take(\n  // expect: id-length error\n  x: number,\n  yy: number,\n  longParam: number,\n): void {\n  void x;\n  void yy;\n  void longParam;\n}\nJSON.stringify({ a, ab, longer, f, go, C, Foo, take });\n")
}

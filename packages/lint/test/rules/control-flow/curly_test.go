package linthost

import "testing"

// TestRuleCorpusCurly verifies the lint rule corpus fixture curly.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in curly.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusCurly(t *testing.T) {
	assertRuleCorpusCase(t, "curly.ts", "// Positive: single-statement `if` body should be wrapped in a block.\nconst flag: boolean = Math.random() > 0.5;\n// expect: curly error\nif (flag) console.log(\"if\");\n\n// Positive: bare `else` branch is flagged the same way.\nif (flag) {\n  console.log(\"then\");\n  // expect: curly error\n} else console.log(\"else\");\n\n// Positive: `while`, `do`, and `for` family loops also require braces.\nlet i: number = 0;\n// expect: curly error\nwhile (i < 1) i += 1;\n\nlet j: number = 0;\n// expect: curly error\ndo j += 1;\nwhile (j < 1);\n\n// expect: curly error\nfor (let k: number = 0; k < 1; k += 1) console.log(k);\n\nconst arr: number[] = [1, 2];\n// expect: curly error\nfor (const value of arr) console.log(value);\n\n// Negative: `else if` chains stay legal — the rule walks into the next\n// IfStatement and reports its body, not the chain itself.\nif (flag) {\n  console.log(\"a\");\n} else if (!flag) {\n  console.log(\"b\");\n} else {\n  console.log(\"c\");\n}\n")
}

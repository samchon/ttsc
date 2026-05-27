package linthost

import "testing"

// TestRuleCorpusNoParamReassign verifies the lint rule corpus fixture no-param-reassign.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-param-reassign.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoParamReassign(t *testing.T) {
	assertRuleCorpusCase(t, "no-param-reassign.ts", "function reassignSimple(x: number): number {\n  // expect: no-param-reassign error\n  x = 1;\n  return x;\n}\n\nfunction reassignCompound(n: number): number {\n  // expect: no-param-reassign error\n  n += 5;\n  return n;\n}\n\nfunction reassignPrefix(i: number): number {\n  // expect: no-param-reassign error\n  ++i;\n  return i;\n}\n\nconst reassignPostfix = (i: number): number => {\n  // expect: no-param-reassign error\n  i--;\n  return i;\n};\n\n// Local variable assignment is fine.\nfunction localOk(x: number): number {\n  let total = 0;\n  total += x;\n  return total;\n}\n\n// Property mutation is left alone by the conservative baseline.\nfunction propertyOk(obj: { count: number }): number {\n  obj.count = 5;\n  return obj.count;\n}\n\n// Reassigning a local variable in an inner function — the outer\n// parameter `x` is only read, never written.\nfunction innerOk(x: number): () => number {\n  let total = x;\n  return () => {\n    total = total + 1;\n    return total;\n  };\n}\n\nJSON.stringify([\n  reassignSimple(0),\n  reassignCompound(0),\n  reassignPrefix(0),\n  reassignPostfix(0),\n  localOk(0),\n  propertyOk({ count: 0 }),\n  innerOk(0)(),\n]);\n")
}

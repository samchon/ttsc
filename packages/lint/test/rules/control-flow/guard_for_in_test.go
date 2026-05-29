package linthost

import "testing"

// TestRuleCorpusGuardForIn verifies the lint rule corpus fixture guard-for-in.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in guard-for-in.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusGuardForIn(t *testing.T) {
  assertRuleCorpusCase(t, "guard-for-in.ts", "// Positive: an unguarded `for...in` body walks the prototype chain and\n// processes inherited keys exactly the same as own keys.\nfunction dumpAll(obj: Record<string, unknown>): void {\n  // expect: guard-for-in error\n  for (const key in obj) {\n    console.log(key, obj[key]);\n  }\n}\n\n// Positive: a guard that lives below another statement is not the very\n// first statement of the body, so the inherited-key check still leaks\n// the work above it.\nfunction dumpAfterEffect(obj: Record<string, unknown>): void {\n  // expect: guard-for-in error\n  for (const key in obj) {\n    console.log(\"scanning\", key);\n    if (Object.hasOwn(obj, key)) {\n      console.log(obj[key]);\n    }\n  }\n}\n\n// Negative: `Object.hasOwn(obj, key)` immediately guards the body.\nfunction dumpWithHasOwn(obj: Record<string, unknown>): void {\n  for (const key in obj) {\n    if (Object.hasOwn(obj, key)) {\n      console.log(key, obj[key]);\n    }\n  }\n}\n\n// Negative: `Object.prototype.hasOwnProperty.call(obj, key)` is the\n// older guard form and is accepted on the same terms.\nfunction dumpWithHasOwnPropertyCall(obj: Record<string, unknown>): void {\n  for (const key in obj) {\n    if (Object.prototype.hasOwnProperty.call(obj, key)) {\n      console.log(key, obj[key]);\n    }\n  }\n}\n\n// Negative: a `continue` guarded by the negated check is the canonical\n// early-skip pattern and is also accepted.\nfunction dumpWithEarlyContinue(obj: Record<string, unknown>): void {\n  for (const key in obj) {\n    if (!Object.hasOwn(obj, key)) {\n      continue;\n    }\n    console.log(key, obj[key]);\n  }\n}\n\nJSON.stringify({\n  dumpAll: dumpAll({ a: 1 }),\n  dumpAfterEffect: dumpAfterEffect({ a: 1 }),\n  dumpWithHasOwn: dumpWithHasOwn({ a: 1 }),\n  dumpWithHasOwnPropertyCall: dumpWithHasOwnPropertyCall({ a: 1 }),\n  dumpWithEarlyContinue: dumpWithEarlyContinue({ a: 1 }),\n});\n")
}

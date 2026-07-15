package linthost

import "testing"

// TestRuleCorpusNoDupeKeys verifies the lint rule corpus fixture no-dupe-keys.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-dupe-keys.ts and compares normalized
// rule, severity, and line triples. It pairs a literal-key duplicate with a computed one that
// resolves to the same static key (`["a"]` duplicates `a`) and two distinct dynamic computed
// keys (`[key()]`) that must stay silent. The source below is byte-identical to
// tests/test-lint/src/cases/no-dupe-keys.ts, which the TypeScript corpus runner drives through
// the real ttsc command path.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoDupeKeys(t *testing.T) {
  assertRuleCorpusCase(t, "no-dupe-keys.ts", `const o = {
  a: 1,
  // expect: no-dupe-keys error
  a: 2,
};
JSON.stringify(o);

declare function key(): string;

const computed = {
  a: 1,
  // expect: no-dupe-keys error
  ["a"]: 2,
  [key()]: 3,
  [key()]: 4,
};
JSON.stringify(computed);
`)
}

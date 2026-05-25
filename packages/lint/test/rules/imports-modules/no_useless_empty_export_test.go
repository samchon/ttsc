package linthost

import "testing"

// TestRuleCorpusNoUselessEmptyExport verifies the lint rule corpus fixture no-useless-empty-export.ts.
//
// Empty `export {}` is a useful module marker only until another import/export
// already marks the surrounding source file as a module. This pins the
// top-level redundant marker path without depending on import resolution.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoUselessEmptyExport(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-empty-export.ts", `export const marker = 1;

// expect: no-useless-empty-export error
export {};

JSON.stringify(marker);
`)
}

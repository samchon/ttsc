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
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the empty export after an exported value already marks the file as a module.
// @evidence contracts/testing.md#independent-expectations The authored marker names a redundant module marker; the exported marker value independently establishes prior module status.
// @evidence contracts/testing.md#distinguishing-cases Redundant positive is paired with TestNoUselessEmptyExportAllowsModuleMarker for the identical syntax when it is necessary.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs the authored exported-value/empty-export fixture through the rule engine and compares the literal annotation-derived diagnostic. This entry owns the redundant-marker result.
func TestRuleCorpusNoUselessEmptyExport(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-empty-export.ts", `export const marker = 1;

// expect: typescript/no-useless-empty-export error
export {};

JSON.stringify(marker);
`)
}

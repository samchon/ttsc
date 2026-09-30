package linthost

import "testing"

// TestPreferConstPreservesMigratedLexicalControls verifies all three original
// lexical, later-assignment and destructuring findings.
//
// Lexically distinct bindings and partly mutable patterns must retain their
// original diagnostic set without repeating package discovery or native builds.
//
// 1. Run the original annotated fixture through the owning rule engine.
// 2. Compare every finding while retaining the same-named mutable sibling.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase executes prefer-const through Engine and compares normalized rule, severity and line triples; a missing stable binding or a report on the mutable sibling fails the complete comparison.
// @evidence contracts/testing.md#independent-expectations The three authored expect comments in the migrated fixture identify stable lexical, assigned-later and stable destructured bindings independently of Engine output.
// @evidence contracts/testing.md#distinguishing-cases Stable and reassigned same-spelled sibling bindings distinguish lexical identity; assigned-later and partly mutable destructuring preserve the remaining two original decisions.
// @evidence contracts/testing.md#execution-ownership The exported Go Test entry runs once in the shared lint Go process against owning operations; it builds no contributor artifact and starts no CLI child. Package auto-discovery and native transport remain in the surviving E2E batch.
func TestPreferConstPreservesMigratedLexicalControls(t *testing.T) {
 assertRuleCorpusCase(t, "case.ts", "function shouldReport(): number {\n  // expect: prefer-const error\n  let value = 1;\n  return value;\n}\n\nfunction sameNameButReassigned(): number {\n  let value = 1;\n  value += 1;\n  return value;\n}\n\nlet assignedLater: number;\n// expect: prefer-const error\nassignedLater = 1;\n\nconst input = { first: 1, second: 2 };\n// expect: prefer-const error\nlet { first, second } = input;\nfirst += 1;\n\nconsole.log(\n  shouldReport(),\n  sameNameButReassigned(),\n  assignedLater,\n  first,\n  second,\n);\n")
}

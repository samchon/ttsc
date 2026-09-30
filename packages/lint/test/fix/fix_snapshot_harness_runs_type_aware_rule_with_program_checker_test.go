package linthost

import "testing"

// TestFixSnapshotHarnessRunsTypeAwareRuleWithProgramChecker verifies typed fixer snapshots use a real Program.
//
// Prefer-const cannot resolve binding identity without Context.Checker. A
// parser-only snapshot would therefore produce no edit, while a Program-backed
// TSX snapshot must preserve the caller's grammar and rewrite the stable let.
//
// 1. Record the Program lifecycle sequence and materialize a TSX fixer case.
// 2. Apply the type-aware prefer-const edit through the shared snapshot helper.
// 3. Assert a Program was created and the exact on-disk rewrite succeeded.
//
// @evidence contracts/testing.md#behavioral-verification The snapshot lifecycle creates a real Program/checker and fixes stable in a TSX prefer-const fixture.
// @evidence contracts/testing.md#independent-expectations Literal TSX output and a strictly advanced programLifecycleSequence independently reject both missing fixing and a parser-only lifecycle.
// @evidence contracts/testing.md#distinguishing-cases The typed rule differs from the parser-only no-var companion while both preserve JSX and caller-selected filenames.
// @evidence contracts/testing.md#execution-ownership TestFixSnapshotHarnessRunsTypeAwareRuleWithProgramChecker calls assertFixSnapshotFile with prefer-const and observes the real in-process Program lifecycle.
func TestFixSnapshotHarnessRunsTypeAwareRuleWithProgramChecker(t *testing.T) {
  before := programLifecycleSequence.Load()
  assertFixSnapshotFile(
    t,
    "prefer-const",
    "component.tsx",
    "const view = <div />;\nlet stable = 1;\nJSON.stringify([view, stable]);\n",
    "const view = <div />;\nconst stable = 1;\nJSON.stringify([view, stable]);\n",
  )
  if after := programLifecycleSequence.Load(); after <= before {
    t.Fatalf("type-aware fixer snapshot did not create a Program: before=%d after=%d", before, after)
  }
}

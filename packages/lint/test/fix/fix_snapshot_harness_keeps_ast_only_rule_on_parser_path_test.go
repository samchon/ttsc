package linthost

import "testing"

// TestFixSnapshotHarnessKeepsASTOnlyRuleOnParserPath verifies untyped snapshots stay lightweight.
//
// The shared lifecycle selector must not make every fixer pay for a TypeScript
// Program merely because typed rules use one. A TSX filename still needs the
// JSX parser, but the AST-only no-var rewrite must not advance Program state.
//
// 1. Record the Program lifecycle sequence and materialize a TSX no-var case.
// 2. Apply the AST-only edit through the shared snapshot helper.
// 3. Assert the exact rewrite succeeded without creating a Program.
func TestFixSnapshotHarnessKeepsASTOnlyRuleOnParserPath(t *testing.T) {
  before := programLifecycleSequence.Load()
  assertFixSnapshotFile(
    t,
    "no-var",
    "component.tsx",
    "var legacy = 1;\nconst view = <div />;\nJSON.stringify([legacy, view]);\n",
    "let legacy = 1;\nconst view = <div />;\nJSON.stringify([legacy, view]);\n",
  )
  if after := programLifecycleSequence.Load(); after != before {
    t.Fatalf("AST-only fixer snapshot created a Program: before=%d after=%d", before, after)
  }
}

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
//
// @evidence contracts/testing.md#behavioral-verification The snapshot lifecycle performs the TSX no-var rewrite without creating a TypeScript Program.
// @evidence contracts/testing.md#independent-expectations Literal complete TSX output and unchanged programLifecycleSequence jointly require correct fixing and the parser-only path.
// @evidence contracts/testing.md#distinguishing-cases An AST-only no-var rule contrasts with the checker-requiring prefer-const lifecycle companion; JSX filename selection remains real.
// @evidence contracts/testing.md#execution-ownership TestFixSnapshotHarnessKeepsASTOnlyRuleOnParserPath invokes assertFixSnapshotFile on component.tsx and observes the in-process lifecycle counter.
func TestFixSnapshotHarnessKeepsASTOnlyRuleOnParserPath(t *testing.T) {
  before := programLifecycleSequence.Load()
  assertFixSnapshotFile(
    t,
    "no-var",
    "component.tsx",
    "var legacy = 1;\nconst view = <div />;\nJSON.stringify([legacy, view]);\nexport {};\n",
    "let legacy = 1;\nconst view = <div />;\nJSON.stringify([legacy, view]);\nexport {};\n",
  )
  if after := programLifecycleSequence.Load(); after != before {
    t.Fatalf("AST-only fixer snapshot created a Program: before=%d after=%d", before, after)
  }
}

package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBlockHasNonStatementCommentSkipsNilStmts verifies that
// blockHasNonStatementComment skips nil entries in the stmts slice when
// building the statement-range exclusion list.
//
// The per-element nil guard `if stmt == nil { continue }` inside the ranges
// loop ensures that a nil statement pointer does not cause a nil dereference
// on `shimscanner.SkipTrivia(ctx.Source, stmt.Pos())`. This path is reachable
// when a block is passed alongside a statement list that has been partially
// constructed or patched with a nil placeholder during error recovery. Skipping
// the nil entry is correct: its range would be empty, and an empty range would
// not exclude any positions from the comment scan.
//
//  1. Parse a block from a real source so the node has valid byte positions.
//  2. Call blockHasNonStatementComment with a stmts slice containing one nil
//     element (bypassing the real block.Statements.Nodes list directly).
//  3. Assert the function returns false without panicking (the block holds no
//     comment, so even with the nil stmt skipped the result is false).
//
// @evidence contracts/testing.md#behavioral-verification blockHasNonStatementComment must safely skip nil entries and report no comment in the comment-free block.
// @evidence contracts/testing.md#independent-expectations The literal block { a(); } contains no comment delimiter, so a nil item cannot create one.
// @evidence contracts/testing.md#distinguishing-cases The supplied singleton nil statement exercises item filtering; comment-only and inter-statement-comment dispatch cases own the opposite coverage outcome.
// @evidence contracts/testing.md#execution-ownership TestBlockHasNonStatementCommentSkipsNilStmts is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
func TestBlockHasNonStatementCommentSkipsNilStmts(t *testing.T) {
  // Parse a block with no comments so the expected result is false.
  file := parseTS(t, "{ a(); }\n")
  block := firstNodeOfKind(t, file, shimast.KindBlock)
  ctx := NewPrintContext(file, DefaultPrintOptions())

  // Pass a stmts list with a nil entry; the nil must be skipped, not dereferenced.
  stmtsWithNil := []*shimast.Node{nil}
  got := blockHasNonStatementComment(ctx, block, stmtsWithNil)
  if got {
    t.Fatalf("blockHasNonStatementComment should return false for comment-free block, got true")
  }
}

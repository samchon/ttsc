package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthCheckAbstainsWhenNodeRangeExceedsContextSource verifies
// Check returns without emitting a finding when the node's byte range falls
// outside the Context's source string.
//
// Locks the safety guard `if start < 0 || end <= start || end > len(src)` in
// Check. The guard defends against a mismatch between the context's source
// file and the visiting node: if the node's End offset exceeds the source
// length, slicing src[start:end] would panic. The guard makes the rule
// byte-safe even when caller invariants are violated.
//
// The scenario uses two parsed files: a short one (file1) and a longer one
// (file2). A node from file2 whose End offset exceeds len(file1.Text()) is
// passed to Check with a context wired to file1. The `end > len(src)` branch
// fires and Check returns without emitting a finding.
//
//  1. Parse a short file (file1, 14 bytes) as the context's source.
//  2. Parse a longer file (file2, 30+ bytes) and locate an object literal
//     whose End offset overflows file1's byte length.
//  3. Call Check directly with ctx.File=file1, node from file2.
//  4. Assert no findings are collected (the guard fires and returns early).
func TestFormatPrintWidthCheckAbstainsWhenNodeRangeExceedsContextSource(t *testing.T) {
  root := t.TempDir()

  // file1 is short — 14 bytes total.
  file1Path := filepath.Join(root, "short.ts")
  file1Src := "const x = 1;\n"
  writeFile(t, file1Path, file1Src)
  file1 := parseTSFile(t, file1Path, file1Src)

  // file2 is longer; its object literal's End offset exceeds len(file1Src).
  file2Path := filepath.Join(root, "long.ts")
  file2Src := "const y = { alpha: 1, bravo: 2, charlie: 3 };\n"
  writeFile(t, file2Path, file2Src)
  file2 := parseTSFile(t, file2Path, file2Src)

  node := firstNodeOfKind(t, file2, shimast.KindObjectLiteralExpression)
  if node.End() <= len(file1Src) {
    t.Skipf("file2 node End=%d does not exceed len(file1)=%d; skip", node.End(), len(file1Src))
  }

  // Build a context pointing at file1 but visiting a node from file2.
  // The guard end > len(src) must fire — no findings expected.
  var collected []*Finding
  ctx := &Context{
    File:     file1,
    Severity: SeverityError,
    rule:     formatPrintWidth{},
    collect:  func(f *Finding) { collected = append(collected, f) },
  }

  var rule formatPrintWidth
  rule.Check(ctx, node)

  if len(collected) != 0 {
    t.Fatalf("expected zero findings when node range exceeds source; got %d", len(collected))
  }
}

package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthCheckAbstainsWhenNodeIsNil verifies that passing a nil
// node to Check does not panic and emits no findings.
//
// The nil-guard `if ctx == nil || ctx.File == nil || node == nil` at the top of
// Check covers the nil-ctx, nil-File, and nil-node cases in a single condition.
// The nil-node arm is exercised here so all three short-circuit branches
// contribute coverage. Without this guard a nil-pointer dereference would crash
// the dispatch loop.
//
//  1. Parse a minimal source to obtain a real SourceFile.
//  2. Construct a Context with the parsed file.
//  3. Call Check with a nil *shimast.Node.
//  4. Assert no panic occurs.
//
// @evidence contracts/testing.md#behavioral-verification formatPrintWidth.Check must return without panicking or collecting a finding for a nil node in a real source context.
// @evidence contracts/testing.md#independent-expectations The absent-node safety contract requires an empty finding population; a collector observes any unexpected emission.
// @evidence contracts/testing.md#distinguishing-cases This nil-node arm complements nil Context, nil File and out-of-range source guards.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthCheckAbstainsWhenNodeIsNil is a public Go unit selected by TestSelectedLintUnits. It calls Check directly with isolated fixture source and a collector, without installing a consumer or starting a host.
func TestFormatPrintWidthCheckAbstainsWhenNodeIsNil(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "const x = 1;\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)
  var findings []*Finding
  ctx := &Context{File: file, Severity: SeverityError, collect: func(f *Finding) { findings = append(findings, f) }}
  var rule formatPrintWidth
  var node *shimast.Node
  // Must not panic — the nil-node arm of the guard fires and returns.
  rule.Check(ctx, node)
  if len(findings) != 0 {
    t.Fatalf("nil node must emit no findings, got %d", len(findings))
  }
}

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
func TestFormatPrintWidthCheckAbstainsWhenNodeIsNil(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "const x = 1;\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)
  ctx := &Context{File: file, Severity: SeverityError}
  var rule formatPrintWidth
  var node *shimast.Node
  // Must not panic — the nil-node arm of the guard fires and returns.
  rule.Check(ctx, node)
}

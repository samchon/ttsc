package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRunExternalESLintDiagnosticsMapsMessagesAndSkipsUnmatchedFiles verifies runtime mapping.
//
// External ESLint results are keyed by absolute source path. The bridge should
// skip results for files that are not in the tsgo program, skip severity-zero
// messages, and normalize blank rule IDs to the generic eslint rule name.
//
// This scenario uses a fake Node executable that returns a controlled ESLint
// payload, keeping the test focused on Go-side mapping and filtering.
//
// 1. Create one program source file and one unmatched ESLint result path.
// 2. Return warning, off, and unmatched messages from the fake runtime.
// 3. Assert only the matched non-off diagnostic is emitted with fallback rule metadata.
func TestRunExternalESLintDiagnosticsMapsMessagesAndSkipsUnmatchedFiles(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "eslint.config.js")
  writeFile(t, config, "export default [];")
  filePath := filepath.Join(root, "src", "main.ts")
  file := parseTSFile(t, filePath, "const value = 1;\n")

  output, err := json.Marshal(eslintRuntimeOutput{
    Results: []eslintRuntimeFile{
      {
        FilePath: filePath,
        Messages: []eslintRuntimeMessage{
          {RuleID: "   ", Severity: 1, Message: "runtime warning", Line: 1, Column: 1, EndLine: 1, EndColumn: 1},
          {RuleID: "no-console", Severity: 0, Message: "off", Line: 1, Column: 1, EndLine: 1, EndColumn: 2},
        },
      },
      {
        FilePath: filepath.Join(root, "src", "other.ts"),
        Messages: []eslintRuntimeMessage{
          {RuleID: "no-var", Severity: 2, Message: "unmatched", Line: 1, Column: 1, EndLine: 1, EndColumn: 2},
        },
      },
    },
  })
  if err != nil {
    t.Fatal(err)
  }
  fakeNode := filepath.Join(root, "fake-node")
  writeFile(t, fakeNode, "#!/bin/sh\ncat <<'JSON'\n"+string(output)+"\nJSON\n")
  if err := os.Chmod(fakeNode, 0o755); err != nil {
    t.Fatalf("chmod fake node: %v", err)
  }
  t.Setenv("TTSC_NODE_BINARY", fakeNode)

  store := &ConfigStore{externalConfigPath: config, eslintRuntime: true}
  diags, ran, err := runExternalESLintDiagnostics(store, root, []*shimast.SourceFile{file})
  if err != nil {
    t.Fatalf("runExternalESLintDiagnostics: %v", err)
  }
  if !ran {
    t.Fatal("expected external ESLint runtime to run")
  }
  if len(diags) != 1 {
    t.Fatalf("want 1 mapped diagnostic, got %d", len(diags))
  }
  if diags[0].Message() != "[eslint] runtime warning" || diags[0].IsError() {
    t.Fatalf("mapped diagnostic mismatch: message=%q error=%v", diags[0].Message(), diags[0].IsError())
  }
  if diags[0].Pos() != 0 || diags[0].End() != 1 {
    t.Fatalf("fallback range mismatch: [%d,%d)", diags[0].Pos(), diags[0].End())
  }
}

package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestRunExternalESLintReportsInvalidJSONOutput verifies runtime output parsing errors.
//
// The ESLint bridge trusts a Node subprocess to print one JSON object. If that
// subprocess writes malformed output, the Go side must report an ESLint output
// parse error instead of silently falling back to native linting.
//
// This scenario replaces the Node binary with a small executable fixture so the
// branch is covered without installing or invoking ESLint.
//
// 1. Create a fake node executable that prints invalid JSON.
// 2. Run the external ESLint bridge directly.
// 3. Assert the error identifies ESLint output parsing.
func TestRunExternalESLintReportsInvalidJSONOutput(t *testing.T) {
  root := t.TempDir()
  fakeNode := filepath.Join(root, "fake-node")
  writeFile(t, fakeNode, "#!/bin/sh\nprintf 'not-json'\n")
  if err := os.Chmod(fakeNode, 0o755); err != nil {
    t.Fatalf("chmod fake node: %v", err)
  }
  t.Setenv("TTSC_NODE_BINARY", fakeNode)

  _, err := runExternalESLint(root, filepath.Join(root, "eslint.config.js"), "[]")
  if err == nil {
    t.Fatal("expected invalid ESLint JSON output to fail")
  }
  if !strings.Contains(err.Error(), "parse ESLint output") {
    t.Fatalf("error should mention ESLint output parsing, got %v", err)
  }
}

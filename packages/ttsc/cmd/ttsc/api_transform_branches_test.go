package main

import (
  "strings"
  "testing"
)

// TestAPITransformBranches verifies api-transform rejects invalid command and project setup.
//
// Source-to-source API callers need the same stable wrapper diagnostics as the
// compile API, but without touching emit. These branches are command-frontdoor
// behavior rather than TypeScript-Go internals.
//
// 1. Pass an incomplete flag.
// 2. Force cwd resolution to fail.
// 3. Point the API at a missing tsconfig.
func TestAPITransformBranches(t *testing.T) {
  code, _, _ := captureCommand(t, func() int {
    return runAPITransform([]string{"--cwd"})
  })
  if code != 2 {
    t.Fatalf("bad flag status mismatch: %d", code)
  }

  code, _, errText := captureCommand(t, func() int {
    getwd = failGetwd
    return runAPITransform(nil)
  })
  if code != 2 || !strings.Contains(errText, "cwd boom") {
    t.Fatalf("cwd error mismatch: code=%d stderr=%q", code, errText)
  }

  code, _, errText = captureCommand(t, func() int {
    return runAPITransform([]string{"--cwd", t.TempDir(), "--tsconfig", "missing.json"})
  })
  if code != 2 || !strings.Contains(errText, "tsconfig not found") {
    t.Fatalf("missing config mismatch: code=%d stderr=%q", code, errText)
  }
}

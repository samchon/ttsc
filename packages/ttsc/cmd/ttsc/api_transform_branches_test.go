package main

import (
  "strings"
  "testing"
)

// TestAPITransformBranches verifies API transform rejects invalid command and project setup.
//
// These cases call the actual noEmit command wrapper. The missing configuration is read from an empty native fixture directory; no source graph or successful source-response assertion is made by this negative setup test.
//
// 1. Pass an incomplete cwd flag and assert rejection.
// 2. Inject the failing cwd reader and assert its literal cause.
// 3. Select missing.json in a fresh fixture directory and assert the missing-config cause.
//
// @evidence contracts/testing.md#behavioral-verification Direct runAPITransform returns status two for incomplete flags, cwd failure and a missing configuration, with asserted cwd/config diagnostic fragments.
// @evidence contracts/testing.md#independent-expectations Literal status two, cwd boom and tsconfig not found follow from the authored invalid argv, error reader and absent fixture config. The first check alone cannot distinguish every status-two cause.
// @evidence contracts/testing.md#distinguishing-cases Parse misuse, implicit cwd failure and explicit cwd/missing config are distinct negative branches; successful source/graph response cases are owned by the aggregate family.
// @evidence contracts/testing.md#execution-ownership This same-process Go unit calls the owning wrapper and real missing-config resolver, not an installed host or subprocess. captureCommand defers stream/getwd restoration and TempDir owns the native fixture; there is no acquired successful Program in these setup failures.
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

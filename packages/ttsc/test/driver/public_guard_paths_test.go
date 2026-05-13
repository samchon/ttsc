package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverPublicGuardPaths verifies exported driver helpers fail safely for
// nil or manually-assembled inputs.
//
// These guards are command-facing fallback behavior, so the test avoids real
// compiler state and checks the stable public error/string results directly.
//
// 1. Exercise diagnostic helpers without a shim diagnostic anchor.
// 2. Exercise nil Program inspection and emit entrypoints.
// 3. Assert each guard returns a plain result or error instead of panicking.
func TestDriverPublicGuardPaths(t *testing.T) {
  // Diagnostic assertion: manually assembled diagnostics still need useful
  // severity and string behavior for command-side error messages.
  warning := driver.Diagnostic{
    File:     "index.ts",
    Line:     2,
    Column:   3,
    Message:  "warn",
    Severity: driver.SeverityWarning,
  }
  if warning.IsError() {
    t.Fatal("warning diagnostic should not be an error")
  }
  if got := warning.String(); got != "index.ts:2:3: warn" {
    t.Fatalf("unexpected diagnostic string: %q", got)
  }
  if got := (driver.Diagnostic{File: "index.ts", Message: "plain"}).String(); got != "index.ts: plain" {
    t.Fatalf("unexpected file-only diagnostic string: %q", got)
  }

  // Guard assertion: nil programs should expose empty inspection results and
  // stable errors across all public emit facades.
  var prog *driver.Program
  if prog.SourceFile("index.ts") != nil {
    t.Fatal("nil Program SourceFile should return nil")
  }
  if len(prog.SourceFiles()) != 0 {
    t.Fatal("nil Program SourceFiles should return empty slice")
  }
  if _, _, err := driver.CreateProgramFromConfig(nil, nil); err == nil || !strings.Contains(err.Error(), "nil parsed") {
    t.Fatalf("CreateProgramFromConfig nil error mismatch: %v", err)
  }
  if _, _, err := prog.EmitAllRaw(nil); err == nil || !strings.Contains(err.Error(), "nil program") {
    t.Fatalf("EmitAllRaw nil error mismatch: %v", err)
  }
  if _, _, err := prog.EmitAll(nil, nil); err == nil || !strings.Contains(err.Error(), "nil program") {
    t.Fatalf("EmitAll nil error mismatch: %v", err)
  }
  if _, _, err := prog.EmitFile(nil, nil, nil); err == nil || !strings.Contains(err.Error(), "nil program") {
    t.Fatalf("EmitFile nil error mismatch: %v", err)
  }
}

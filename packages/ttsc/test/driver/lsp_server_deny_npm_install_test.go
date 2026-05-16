package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerDenyNpmInstall covers the NpmInstall callback ttscserver
// passes to tsgo's LSP. The host must report a clean refusal so tsgo
// reports the failure back to the editor instead of attempting npm.
//
// 1. Invoke DenyNpmInstall with a sample args slice.
// 2. Assert the returned []byte is nil.
// 3. Assert the error mentions "npm install disabled".
func TestLSPServerDenyNpmInstall(t *testing.T) {
  data, err := driver.DenyNpmInstall("/tmp/project", []string{"install", "@types/node"})
  if data != nil {
    t.Fatalf("expected nil data, got %q", data)
  }
  if err == nil {
    t.Fatal("expected error, got nil")
  }
  if !strings.Contains(err.Error(), "npm install disabled") {
    t.Fatalf("error message mismatch: %v", err)
  }
  if !strings.Contains(err.Error(), "install") {
    t.Fatalf("error should echo the requested args: %v", err)
  }
}

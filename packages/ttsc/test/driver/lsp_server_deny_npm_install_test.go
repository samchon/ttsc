package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerDenyNpmInstall Verifies the legacy NpmInstall callback retained for
// source compatibility with older in-process LSP embedders. It must keep
// reporting a clean refusal instead of attempting npm.
//
// 1. Invoke DenyNpmInstall with a sample args slice.
// 2. Assert the returned []byte is nil.
// 3. Assert the error mentions "npm install disabled".
//
// @evidence contracts/testing.md#behavioral-verification DenyNpmInstall returns nil data and an error containing npm install disabled and the requested install argument.
// @evidence contracts/testing.md#independent-expectations The compatibility callable promises refusal, so its independent input args must appear in an explicit denial rather than an installation result.
// @evidence contracts/testing.md#distinguishing-cases A nonempty install/@types/node request owns refusal; this body does not verify the external tsgo ATA policy.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the compatibility helper directly; no npm command or LSP server is started.
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

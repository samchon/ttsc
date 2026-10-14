package main

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "testing"
)

// TestReadGoTuple verifies the selected stock-Go tool and effective build mode.
//
// Verifies: an eligible native tuple names the actual tool bytes and reported architecture, while unsupported flags and CGO retain source-build selection.
// 1. Probe the host Go executable with CGO disabled and no ambient GOFLAGS.
// 2. Compare its digest and version with independent Go and file readings.
// 3. Set GOFLAGS and CGO independently and require tuple rejection.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production tuple probe against the actual installed Go command and observes both eligible fields and rejected environments.
// @evidence contracts/testing.md#independent-expectations Direct file SHA-256 and runtime's Go version provide independent tool expectations; Go's effective environment, not a caller's guessed default, decides CGO eligibility.
// @evidence contracts/testing.md#distinguishing-cases Covers a complete CGO=0 tuple, an effective flag override and CGO=1; release manifest authentication is covered by the parser test.
// @evidence contracts/testing.md#execution-ownership Runs bounded local Go identity probes without building source modules, downloading packages or writing repository files.
func TestReadGoTuple(t *testing.T) {
  if !supportedGoVersion.MatchString(runtime.Version()) {
    t.Skip("the artifact tuple requires a stock Go 1.26 patch release")
  }
  goBinary, err := exec.LookPath("go")
  if err != nil {
    t.Fatal(err)
  }
  goBinary, err = filepath.Abs(goBinary)
  if err != nil {
    t.Fatal(err)
  }
  t.Setenv("CGO_ENABLED", "0")
  t.Setenv("GOFLAGS", "")
  t.Setenv("GOOS", runtime.GOOS)
  t.Setenv("GOARCH", runtime.GOARCH)
  t.Setenv("GOTOOLCHAIN", "local")
  tuple, err := readGoTuple(goBinary)
  if err != nil {
    t.Fatal(err)
  }
  raw, err := os.ReadFile(goBinary)
  if err != nil {
    t.Fatal(err)
  }
  digest := sha256.Sum256(raw)
  if tuple.GoToolSHA256 != hex.EncodeToString(digest[:]) || tuple.GoVersion != runtime.Version() || tuple.GOOS != runtime.GOOS || tuple.GOARCH != runtime.GOARCH || tuple.CGOEnabled != "0" || tuple.ToolIDsSHA256 == "" {
    t.Fatalf("reported tuple differs from the selected Go tool: %+v", tuple)
  }
  t.Setenv("GOFLAGS", "-tags=foreign")
  if _, err := readGoTuple(goBinary); err == nil {
    t.Fatal("GOFLAGS override was admitted")
  }
  t.Setenv("GOFLAGS", "")
  t.Setenv("CGO_ENABLED", "1")
  if _, err := readGoTuple(goBinary); err == nil {
    t.Fatal("effective CGO mode was admitted")
  }
}

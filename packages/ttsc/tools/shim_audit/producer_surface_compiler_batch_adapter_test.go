package main

import (
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestProducerSurfaceAdmitsOnlyPrivateCompilerBatchAdapter verifies that the
// stock compiler audit can inspect the shim without the opt-in batch package.
//
// 1. Scan a compiler shim with a private, tagged adapter for the absent package.
// 2. Scan variants with different tags, imports or exposed declarations.
// 3. Require each invalid variant to report the unresolved type information.
//
// @evidence contracts/testing.md#behavioral-verification Each case calls the audit's producer scan on an authored shim and checks its actual missing-package verdict.
// @evidence contracts/testing.md#independent-expectations Changing the tag, package or visibility removes the reason the pinned audit can accept an absent optional dependency.
// @evidence contracts/testing.md#distinguishing-cases Exact opt-in, ordinary builds, unrelated packages, exported functions and consumer-visible aliases use the same scan with different authored source.
// @evidence contracts/testing.md#execution-ownership The Go test runner owns one temporary shim tree. The test starts no compiler, processes or external package resolution.
func TestProducerSurfaceAdmitsOnlyPrivateCompilerBatchAdapter(t *testing.T) {
  const optIn = "//go:build ttsc_compiler_batch\n\n"
  const privateAdapter = "func beginBatch() (func(), func()) { return optional.Begin() }"
  root := t.TempDir()
  compiler := filepath.Join(root, "compiler")
  if err := os.Mkdir(compiler, 0o700); err != nil {
    t.Fatal(err)
  }
  for _, tc := range []struct {
    name, header, imported, declaration string
    allowed                            bool
  }{
    {"private batch adapter", optIn, "batch", privateAdapter, true},
    {"untagged batch import", "", "batch", privateAdapter, false},
    {"tag admits stock builds", "//go:build ttsc_compiler_batch || linux\n\n", "batch", privateAdapter, false},
    {"ordinary missing import", optIn, "other", privateAdapter, false},
    {"public function", optIn, "batch", "func BeginBatch() (func(), func()) { return optional.Begin() }", false},
    {"type alias", optIn, "batch", privateAdapter + "\ntype Batch = optional.Batch", false},
  } {
    t.Run(tc.name, func(t *testing.T) {
      source := fmt.Sprintf("%spackage compiler\nimport optional %q\n%s\n", tc.header, internalPrefix+tc.imported, tc.declaration)
      if err := os.WriteFile(filepath.Join(compiler, "batch.go"), []byte(source), 0o600); err != nil {
        t.Fatal(err)
      }
      _, err := scanShimProducerSurface(root, nil)
      if tc.allowed {
        if err != nil {
          t.Fatal(err)
        }
      } else if err == nil || !strings.Contains(err.Error(), "internal package "+tc.imported+" has no loaded type information") {
        t.Fatalf("expected missing type information for %s, got %v", tc.imported, err)
      }
    })
  }
}

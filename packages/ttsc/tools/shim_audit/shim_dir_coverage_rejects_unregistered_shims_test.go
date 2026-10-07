package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// Verifies the coverage gate names every unregistered shim directory at any depth.
//
// A shim directory that is missing from the audit's registries would silently
// escape every closure check, so the gate must fail for it, including when it
// is nested, and must stay quiet for registered, bridge and test-only
// directories.
//
//  1. Build a temporary shim root with registered, bridge and test-only folders.
//  2. Require the gate to accept it, and the reachability scan to see a bridge
//     linkname target.
//  3. Add an unregistered top-level shim and an unregistered nested shim and
//     require the error to name both.
//
// @evidence contracts/testing.md#behavioral-verification checkShimDirCoverage and scanShimReachable run over a temporary shim tree: the registered tree passes, the scan records the astnav bridge's linkname target, and two unregistered directories make the gate fail.
// @evidence contracts/testing.md#independent-expectations The registered directory names (ast, vfs/osvfs, astnav) come from the documented audit registries, the unregistered names newpkg and vfs/extra are authored here, and the expected symbol GetTouchingToken is the literal linkname target written into the fixture.
// @evidence contracts/testing.md#distinguishing-cases Registered full re-export, nested registered package, registered bridge, a directory holding only a _test.go file, an unregistered top-level package and an unregistered nested package each get a distinct expected outcome; only the last two may be reported.
// @evidence contracts/testing.md#execution-ownership This source unit runs in tools/shim_audit through go test in one process using temporary files and the audit's own scanner; it starts no subprocess and loads no typescript-go packages.
func TestCheckShimDirCoverageRejectsUnregisteredShims(t *testing.T) {
  root := t.TempDir()
  write := func(relative, text string) {
    t.Helper()
    filename := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(filename), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filename, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  write("ast/shim.go", "package ast\n")
  write("vfs/osvfs/shim.go", "package osvfs\n")
  write("astnav/bridge.go", "package astnav\n\n//go:linkname GetTouchingToken github.com/microsoft/typescript-go/internal/astnav.GetTouchingToken\nfunc GetTouchingToken()\n")
  write("ast/test/only_test.go", "package ast_test\n")

  if err := checkShimDirCoverage(root); err != nil {
    t.Fatalf("registered tree rejected: %v", err)
  }
  reachable, err := scanShimReachable(root)
  if err != nil {
    t.Fatal(err)
  }
  if !reachable.has("astnav", "GetTouchingToken") {
    t.Fatal("the astnav bridge's linkname target was not recorded")
  }

  write("newpkg/shim.go", "package newpkg\n")
  write("vfs/extra/shim.go", "package extra\n")
  err = checkShimDirCoverage(root)
  if err == nil {
    t.Fatal("unregistered shim directories were accepted")
  }
  for _, name := range []string{"newpkg", "vfs/extra"} {
    if !strings.Contains(err.Error(), name) {
      t.Fatalf("error does not name %q: %v", name, err)
    }
  }
  for _, name := range []string{"ast/test", "vfs/osvfs", "astnav"} {
    if strings.Contains(err.Error(), name) {
      t.Fatalf("error names a directory that is allowed (%q): %v", name, err)
    }
  }
}

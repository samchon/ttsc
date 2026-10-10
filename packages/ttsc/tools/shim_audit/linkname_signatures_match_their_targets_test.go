package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestLinknameSignaturesMatchTheirTargets verifies the gate refuses a bodyless
// go:linkname declaration whose signature differs from the function it names.
//
// The toolchain links such a pair silently and the mismatch corrupts arguments
// only at run time, which is the failure a compiler bump can introduce.
//
//  1. Build a temporary compiler module with an internal package and a bridge
//     module below a shim root linking one function and one method of it.
//  2. Require the gate to accept matching declarations.
//  3. Change a parameter type, then drop a parameter, and require the gate to
//     name each mismatched declaration.
//
// @evidence contracts/testing.md#behavioral-verification checkLinknameSignatures loads a real temporary module through go/packages and is required to accept matching declarations and reject each drifted one by name.
// @evidence contracts/testing.md#independent-expectations The target signatures and the drifted declarations are authored literals in the fixture; the expected names come from the fixture, not from the gate's output.
// @evidence contracts/testing.md#distinguishing-cases A matching function and receiver method pass, a changed parameter type fails, and a missing parameter fails, each with its own expected outcome.
// @evidence contracts/testing.md#execution-ownership This tools/shim_audit unit writes a temporary module and loads it with the go command in one test process; it reads no repository bridge.
func TestLinknameSignaturesMatchTheirTargets(t *testing.T) {
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
  write("compiler/go.mod", "module example.com/fixture\n\ngo 1.27\n")
  write("compiler/internal/target/target.go", "package target\n\ntype Box struct{ n int }\n\nfunc join(a string, b int) string { return a }\n\nfunc (b *Box) grow(n int) int { return b.n + n }\n")
  bridge := func(joinParams, growParams string) string {
    return "package bridge\n\nimport (\n  _ \"unsafe\"\n\n  \"example.com/fixture/internal/target\"\n)\n\n" +
      "//go:linkname Join example.com/fixture/internal/target.join\nfunc Join(" + joinParams + ") string\n\n" +
      "//go:linkname Grow example.com/fixture/internal/target.(*Box).grow\nfunc Grow(" + growParams + ") int\n"
  }
  t.Setenv("GOWORK", "off")
  t.Setenv("GOFLAGS", "-mod=mod")

  write("shim/bridge/go.mod", "module example.com/fixture/bridge\n\ngo 1.27\n\nrequire example.com/fixture v0.0.0\n\nreplace example.com/fixture => ../../compiler\n")
  write("shim/bridge/bridge.go", bridge("a string, b int", "b *target.Box, n int"))
  if err := checkLinknameSignatures(filepath.Join(root, "shim")); err != nil {
    t.Fatalf("matching declarations rejected: %v", err)
  }

  write("shim/bridge/bridge.go", bridge("a string, b string", "b *target.Box"))
  err := checkLinknameSignatures(filepath.Join(root, "shim"))
  if err == nil {
    t.Fatal("drifted declarations accepted")
  }
  for _, want := range []string{"Join -> example.com/fixture/internal/target.join: parameter 1 is string, target has int", "Grow -> example.com/fixture/internal/target.(*Box).grow: 1 parameters, target has 2"} {
    if !strings.Contains(err.Error(), want) {
      t.Errorf("missing %q in %v", want, err)
    }
  }
}

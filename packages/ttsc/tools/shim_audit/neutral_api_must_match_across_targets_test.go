package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// Verifies the neutral-API gate accepts matching targets and names every way
// two targets' version-neutral APIs can drift apart.
//
// One plugin source compiles on every compiler target only when each target's
// neutral.go declares the same functions with the same arity. Types are spelled
// through each target's own aliases, so arity is what the source can compare.
//
//  1. Write two shim roots whose neutral.go files declare the same functions.
//  2. Require the gate to accept them, including grouped parameters and a
//     variadic tail, and to ignore methods and unexported helpers.
//  3. Drop a function, change an arity, change variadicity and remove a whole
//     package from one root, and require each drift to be reported by name.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production checkNeutralAPI over real temporary files and asserts acceptance or the reported drift lines.
// @evidence contracts/testing.md#independent-expectations The expected names and counts come from the authored fixture sources, not from the gate's output.
// @evidence contracts/testing.md#distinguishing-cases A matching pair passes; a missing function, a parameter-count change, a variadic change and a package missing on one side fail; methods and unexported functions must not count.
// @evidence contracts/testing.md#execution-ownership This tools/shim_audit unit writes temporary files and parses them in process; it loads no module and starts no process.
func TestNeutralAPIMustMatchAcrossTargets(t *testing.T) {
  write := func(root, rel, text string) {
    t.Helper()
    path := filepath.Join(root, filepath.FromSlash(rel))
    if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  const base = "package tspath\n\nfunc Compare(c bool, a, b string) int { return 0 }\nfunc Join(parts ...string) string { return \"\" }\nfunc helper() {}\ntype T struct{}\nfunc (T) Method(x int) {}\n"
  first, second := t.TempDir(), t.TempDir()
  write(first, "tspath/neutral.go", base)
  write(second, "tspath/neutral.go", strings.ReplaceAll(base, "c bool, a, b string", "c Policy, a Path, b Path")+"type Policy = bool\ntype Path = string\nfunc extra(y string) {}\n")
  write(first, "vfs/shim.go", "package vfs\n\nfunc NotNeutral() {}\n")
  if err := checkNeutralAPI(first, second); err != nil {
    t.Fatalf("matching APIs rejected: %v", err)
  }

  write(second, "tspath/neutral.go", "package tspath\n\nfunc Compare(c bool, a string) int { return 0 }\nfunc Join(parts []string) string { return \"\" }\n")
  write(second, "ast/neutral.go", "package ast\n\nfunc SymbolNameOf(s any) string { return \"\" }\n")
  write(first, "compiler/neutral.go", "package compiler\n\nfunc Only() {}\n")
  err := checkNeutralAPI(first, second)
  if err == nil {
    t.Fatal("drifted APIs accepted")
  }
  for _, want := range []string{
    "tspath.Compare: 3 parameters and 1 results (variadic false)",
    "tspath.Join: 1 parameters and 1 results (variadic true)",
    "ast: neutral API only in " + second,
    "compiler: neutral API only in " + first,
  } {
    if !strings.Contains(err.Error(), want) {
      t.Errorf("missing %q in %v", want, err)
    }
  }

  write(second, "tspath/neutral.go", base)
  if err := os.Remove(filepath.Join(second, "ast", "neutral.go")); err != nil {
    t.Fatal(err)
  }
  write(first, "compiler/neutral.go", "package compiler\n\nfunc Only() {}\nfunc Gone() {}\n")
  write(second, "compiler/neutral.go", "package compiler\n\nfunc Only() {}\n")
  if err := checkNeutralAPI(first, second); err == nil || !strings.Contains(err.Error(), "compiler.Gone: declared only in "+first) {
    t.Fatalf("dropped function not reported: %v", err)
  }
}

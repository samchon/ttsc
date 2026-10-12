package main

import (
  "bytes"
  "go/ast"
  "go/parser"
  "go/token"
  "go/types"
  "os"
  "path/filepath"
  "slices"
  "testing"

  "golang.org/x/tools/go/packages"
)

// Verifies enum generation preserves a family's existing members on every run.
//
// The generator must calculate its entire output independently of its previous
// file. Private references and exports from another shim cannot replace the
// owning package's public constants.
//
//  1. Type-check a literal enum and scan real authored shim files.
//  2. Generate missing members despite private and foreign-package references.
//  3. Repeat generation and require identical bytes and complete public coverage.
//  4. Remove authored constants and retain the existing public family on repeated runs.
//  5. Add a sibling, then hand all constants to authored exports without duplicates.
//
// @evidence contracts/testing.md#behavioral-verification Actual scan, analyze and runFix operations write and reread an owned temporary shim; exported constant names and repeated output bytes detect destructive replacement rather than merely checking an exit status.
// @evidence contracts/testing.md#independent-expectations Literal upstream declarations establish Alpha, Beta, Delta and the later Gamma; expected public names are authored independently of analyzer findings and generated text.
// @evidence contracts/testing.md#distinguishing-cases A public Alpha contrasts with private Delta and a foreign shim's Beta alias; first, repeated and expanded generation distinguish missing members and lost siblings. Zero authored constants retain the already public family; complete authored handoff removes duplicate generated output and remains idempotent.
// @evidence contracts/testing.md#execution-ownership This direct source unit runs in the tools/shim_audit module through go test (the shim:audit:test package script); Go's parser, type checker and filesystem APIs execute in the owning process over temporary shim files without a native compiler producer or subprocess.
func TestEnumGenerationPreservesExistingFamilyMembers(t *testing.T) {
  root := t.TempDir()
  write := func(relative, text string) {
    t.Helper()
    filename := filepath.Join(root, relative)
    if err := os.MkdirAll(filepath.Dir(filename), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filename, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  write("ast/shim.go", `package ast
import innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
type Mode = innerast.Mode
const Alpha = innerast.Alpha
const privateDelta = innerast.Delta
func privateReference() { _ = innerast.Beta }
`)
  write("checker/shim.go", `package checker
import innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
const ForeignBeta = innerast.Beta
`)
  upstream := func(expanded bool) map[string]*packages.Package {
    t.Helper()
    source := `package ast
type Mode int
const ( Alpha Mode = iota; Beta; Delta )
`
    if expanded {
      source += "const Gamma Mode = 3\n"
    }
    fset := token.NewFileSet()
    file, err := parser.ParseFile(fset, "upstream.go", source, 0)
    if err != nil {
      t.Fatal(err)
    }
    pkg, err := (&types.Config{}).Check(internalPrefix+"ast", fset, []*ast.File{file}, nil)
    if err != nil {
      t.Fatal(err)
    }
    return map[string]*packages.Package{"ast": {Types: pkg}}
  }
  generate := func(expanded bool) []byte {
    t.Helper()
    reachable, err := scanShimReachable(root)
    if err != nil {
      t.Fatal(err)
    }
    exports, err := scanShimEnumExports(root, false)
    if err != nil {
      t.Fatal(err)
    }
    family, err := scanShimEnumExports(root, true)
    if err != nil {
      t.Fatal(err)
    }
    findings, _ := analyze(reachable, upstream(expanded), exports, family)
    if err := runFix(findings, root); err != nil {
      t.Fatal(err)
    }
    output, err := os.ReadFile(filepath.Join(root, "ast", "enums_gen.go"))
    if err != nil {
      t.Fatal(err)
    }
    return output
  }
  assertMembers := func(expanded bool, expected []string) {
    t.Helper()
    exports, err := scanShimEnumExports(root, true)
    if err != nil {
      t.Fatal(err)
    }
    actual := make([]string, 0, len(exports["ast"]))
    for name := range exports["ast"] {
      actual = append(actual, name)
    }
    slices.Sort(actual)
    if !slices.Equal(actual, expected) {
      t.Fatalf("public members = %v, want %v", actual, expected)
    }
    reachable, err := scanShimReachable(root)
    if err != nil {
      t.Fatal(err)
    }
    findings, _ := analyze(reachable, upstream(expanded), exports, exports)
    for _, finding := range findings {
      if finding.kind == "ENUM" {
        t.Fatalf("generated family remains incomplete: %+v", finding)
      }
    }
  }
  first := generate(false)
  assertMembers(false, []string{"Alpha", "Beta", "Delta"})
  second := generate(false)
  if !bytes.Equal(first, second) {
    t.Fatal("second generation changed the complete family")
  }
  assertMembers(false, []string{"Alpha", "Beta", "Delta"})
  write("ast/shim.go", `package ast
import innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
type Mode = innerast.Mode
const privateAlpha = innerast.Alpha
`)
  withoutAuthoredMembers := generate(false)
  assertMembers(false, []string{"Alpha", "Beta", "Delta"})
  if !bytes.Equal(withoutAuthoredMembers, generate(false)) {
    t.Fatal("family with no authored constants lost prior public members")
  }
  expanded := generate(true)
  if bytes.Equal(first, expanded) {
    t.Fatal("new upstream sibling was not generated")
  }
  assertMembers(true, []string{"Alpha", "Beta", "Delta", "Gamma"})
  if !bytes.Equal(expanded, generate(true)) {
    t.Fatal("repeated expanded generation changed earlier members")
  }
  write("ast/shim.go", `package ast
import innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
type Mode = innerast.Mode
const (
  Alpha = innerast.Alpha
  Beta = innerast.Beta
  Delta = innerast.Delta
  Gamma = innerast.Gamma
)
`)
  for iteration := range 2 {
    reachable, err := scanShimReachable(root)
    if err != nil {
      t.Fatal(err)
    }
    exports, err := scanShimEnumExports(root, false)
    if err != nil {
      t.Fatal(err)
    }
    family, err := scanShimEnumExports(root, true)
    if err != nil {
      t.Fatal(err)
    }
    findings, _ := analyze(reachable, upstream(true), exports, family)
    if err := runFix(findings, root); err != nil {
      t.Fatal(err)
    }
    if _, err := os.Stat(filepath.Join(root, "ast", "enums_gen.go")); !os.IsNotExist(err) {
      t.Fatalf("authored handoff %d retained duplicate generated members: %v", iteration, err)
    }
    assertMembers(true, []string{"Alpha", "Beta", "Delta", "Gamma"})
  }
}
